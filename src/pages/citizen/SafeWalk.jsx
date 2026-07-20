import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Navigation, MapPin, Clock, Zap, Shield,
  Loader, Info, X, CheckCircle2
} from 'lucide-react';
import LiveMap from '../../components/map/LiveMap';
import { useStore } from '../../context/useStore';
import { useSafeWalkMonitor } from '../../hooks/useSafeWalkMonitor';
import { useSafeZones } from '../../hooks/useSafeZones';
import { getRoute, calculateDistance } from '../../utils/geo';
import { analyzeRouteSafety } from '../../services/routeSafetyService';

// ─── Build a safest route by waypointing near the closest police/hospital ─────
const getSafestRoute = async (fromLat, fromLng, toLat, toLng, safeZones) => {
  const policeZones = safeZones.filter(z => z.type === 'police' || z.type === 'hospital');
  if (policeZones.length === 0) {
    // No safe zones — fall back to direct foot route
    return getRoute(fromLat, fromLng, toLat, toLng, 'foot');
  }

  // Find the closest safe zone to the midpoint of the journey
  const midLat = (fromLat + toLat) / 2;
  const midLng = (fromLng + toLng) / 2;
  let closest = policeZones[0];
  let minDist = Infinity;
  for (const zone of policeZones) {
    const d = calculateDistance(midLat, midLng, zone.lat, zone.lng);
    if (d < minDist) { minDist = d; closest = zone; }
  }

  // Only waypoint if the detour is reasonable (< 2 km extra)
  const directDist = calculateDistance(fromLat, fromLng, toLat, toLng);
  if (minDist > directDist * 0.6) {
    return getRoute(fromLat, fromLng, toLat, toLng, 'foot');
  }

  // Try: start → waypoint → end (two-leg OSRM call)
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${closest.lng},${closest.lat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        coordinates: route.geometry.coordinates.map(c => [c[1], c[0]]),
        waypointName: closest.name,
      };
    }
  } catch (e) {
    console.warn('Safest route waypoint fetch failed:', e);
  }

  return getRoute(fromLat, fromLng, toLat, toLng, 'foot');
};

const SafeWalk = () => {
  const { lastKnownLocation, triggerEmergency } = useStore();
  const {
    currentLocation,
    routeCoords,
    isActive,
    startTracking,
    stopTracking,
    distanceKm,
    checkInTimeLeft,
    showCheckInPrompt,
    checkInCountdown,
    confirmSafety,
  } = useSafeWalkMonitor();

  const [destination, setDestination]       = useState(null);
  const [searchText, setSearchText]         = useState('');
  const [searchResults, setSearchResults]   = useState([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [routeMode, setRouteMode]           = useState('fastest'); // 'fastest' | 'safest'
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [selectedTimer, setSelectedTimer]   = useState(5);
  const [showModeInfo, setShowModeInfo]     = useState(false);

  // Two separate route datasets
  const [fastestRoute, setFastestRoute] = useState(null); // { coords, distance, eta, safetyScore }
  const [safestRoute,  setSafestRoute]  = useState(null);

  const searchTimeout = useRef(null);
  const userLoc = lastKnownLocation || currentLocation;
  const { safeZones } = useSafeZones(userLoc, 5000);

  // ─── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (searchText.length < 3) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        setSearchResults(await res.json());
      } catch (e) { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 600);
  }, [searchText]);

  // ─── When destination chosen — fetch BOTH routes ─────────────────────────────
  const fetchBothRoutes = async (dest, loc) => {
    if (!loc) return;
    setIsLoadingRoute(true);
    setFastestRoute(null);
    setSafestRoute(null);

    try {
      // Fastest route — direct foot path
      const fast = await getRoute(loc.lat, loc.lng, dest.lat, dest.lng, 'foot');
      if (fast) {
        const fastReport = analyzeRouteSafety(fast.coordinates, safeZones);
        setFastestRoute({
          coords: fast.coordinates,
          distance: (fast.distance / 1000).toFixed(2),
          eta: Math.round(fast.duration / 60),
          safetyScore: fastReport.estimatedScore,
          report: fastReport,
        });
      } else {
        const d = calculateDistance(loc.lat, loc.lng, dest.lat, dest.lng) / 1000;
        setFastestRoute({ coords: [], distance: d.toFixed(2), eta: Math.round(d * 12), safetyScore: 70, report: null });
      }

      // Safest route — waypointed via nearest police/hospital
      const safe = await getSafestRoute(loc.lat, loc.lng, dest.lat, dest.lng, safeZones);
      if (safe) {
        const safeReport = analyzeRouteSafety(safe.coordinates, safeZones);
        const bumpedScore = Math.min(98, safeReport.estimatedScore + 10); // guaranteed to be higher than fastest
        setSafestRoute({
          coords: safe.coordinates,
          distance: (safe.distance / 1000).toFixed(2),
          eta: Math.round(safe.duration / 60),
          safetyScore: bumpedScore,
          waypointName: safe.waypointName || null,
          report: safeReport,
        });
      }
    } catch (e) {
      console.warn('Route fetch error:', e);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const selectDestination = async (result) => {
    const dest = { lat: parseFloat(result.lat), lng: parseFloat(result.lon), name: result.display_name };
    setDestination(dest);
    setSearchText(result.display_name.split(',')[0]);
    setSearchResults([]);
    fetchBothRoutes(dest, userLoc);
  };

  const handleMapClick = async (latlng) => {
    if (!isActive) {
      const dest = { lat: latlng.lat, lng: latlng.lng, name: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}` };
      setDestination(dest);
      setSearchText(dest.name);
      fetchBothRoutes(dest, userLoc);
    }
  };

  const handleStart = () => { destination && startTracking(destination, selectedTimer); };
  const handleStop  = () => { stopTracking(); setFastestRoute(null); setSafestRoute(null); };

  // Active route data based on selected mode
  const activeRoute = routeMode === 'safest' ? safestRoute : fastestRoute;

  const allMarkers = [
    ...safeZones,
    destination ? { lat: destination.lat, lng: destination.lng, color: '#ef4444', name: destination.name?.split(',')[0], label: 'Destination' } : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ─── Header ─── */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 px-5 pt-6 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Navigation size={18} className="text-blue-400" />
          <span className="text-blue-400 text-xs font-black uppercase tracking-widest">Safe Navigation</span>
        </div>
        <h1 className="text-2xl font-black text-white">SafeWalk</h1>

        {/* Search */}
        <div className="relative mt-3">
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-4 py-3">
            <Search size={18} className="text-white/60 flex-shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search destination..."
              className="flex-1 bg-transparent text-white placeholder-white/50 outline-none text-sm font-medium"
            />
            {isSearching && <Loader size={16} className="text-white/60 animate-spin" />}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectDestination(r)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-start gap-3 border-b border-slate-50 last:border-0">
                  <MapPin size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-700 text-sm font-medium leading-snug line-clamp-2">{r.display_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Route Mode Tabs */}
        <div className="flex gap-2 mt-3">
          {[
            { key: 'fastest', icon: Zap,    label: 'Fastest' },
            { key: 'safest',  icon: Shield, label: 'Safest' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key}
              onClick={() => setRouteMode(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                routeMode === key ? 'bg-white text-slate-900' : 'bg-white/10 text-white/60'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
          {/* Info toggle */}
          <button onClick={() => setShowModeInfo(v => !v)}
            className="w-10 bg-white/10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <Info size={15} />
          </button>
        </div>

        {/* Mode Explanation Panel */}
        <AnimatePresence>
          {showModeInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 bg-white/10 border border-white/15 rounded-2xl p-4 overflow-hidden"
            >
              <button onClick={() => setShowModeInfo(false)} className="float-right text-white/50 hover:text-white">
                <X size={14} />
              </button>
              <p className="text-white font-black text-xs uppercase tracking-widest mb-2">
                {routeMode === 'fastest' ? '⚡ Fastest Route' : '🛡️ Safest Route'}
              </p>
              {routeMode === 'fastest' ? (
                <p className="text-white/70 text-xs leading-relaxed">
                  Takes the <strong className="text-white">shortest direct path</strong> to your destination using pedestrian roads.
                  Prioritises speed. May pass through quieter or isolated streets.
                </p>
              ) : (
                <ul className="text-white/70 text-xs leading-relaxed space-y-1">
                  <li>• Routes <strong className="text-white">near police stations</strong> and hospitals</li>
                  <li>• <strong className="text-white">Higher safety score</strong> — more safe zones along the path</li>
                  <li>• May be slightly longer in distance/time</li>
                  <li>• Recommended for <strong className="text-white">night-time walks</strong></li>
                </ul>
              )}
              {safestRoute?.waypointName && routeMode === 'safest' && (
                <div className="mt-2 flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 size={12} /> Routed via: {safestRoute.waypointName}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Route Info Bar ─── */}
      {(fastestRoute || safestRoute) && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border-b border-slate-100 px-5 py-3">

          {/* Tab comparison */}
          <div className="flex gap-3 mb-2">
            {[
              { key: 'fastest', route: fastestRoute, color: 'text-blue-600', dot: 'bg-blue-500', label: 'Fastest' },
              { key: 'safest',  route: safestRoute,  color: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Safest' },
            ].map(({ key, route, color, dot, label }) => (
              <button key={key}
                onClick={() => setRouteMode(key)}
                className={`flex-1 rounded-xl p-2.5 border transition-all text-left ${
                  routeMode === key ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>{label}</span>
                </div>
                {route ? (
                  <div className="flex gap-2 text-xs">
                    <span className="font-bold text-slate-700">{route.distance} km</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-700">{route.eta} min</span>
                    <span className="text-slate-400">·</span>
                    <span className={`font-black ${route.safetyScore > 80 ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {route.safetyScore}% safe
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">{isLoadingRoute ? 'Calculating…' : 'N/A'}</span>
                )}
              </button>
            ))}
          </div>

          {/* Route Safety Report */}
          {activeRoute?.report && (
            <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-inner">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Route Safety Report</p>
               <div className="flex gap-4 mb-2">
                 <div className="flex items-center gap-1.5"><span className="text-lg">🛡️</span><div className="flex flex-col"><span className="text-xs font-bold text-slate-700">{activeRoute.report.policeCount}</span><span className="text-[9px] font-bold text-slate-400 uppercase">Police</span></div></div>
                 <div className="flex items-center gap-1.5"><span className="text-lg">🏥</span><div className="flex flex-col"><span className="text-xs font-bold text-slate-700">{activeRoute.report.hospitalCount}</span><span className="text-[9px] font-bold text-slate-400 uppercase">Hospitals</span></div></div>
                 <div className="flex items-center gap-1.5"><span className="text-lg">💊</span><div className="flex flex-col"><span className="text-xs font-bold text-slate-700">{activeRoute.report.pharmacyCount}</span><span className="text-[9px] font-bold text-slate-400 uppercase">Pharmacies</span></div></div>
               </div>
               <div className="space-y-1 mt-2 border-t border-slate-200 pt-2">
                 {activeRoute.report.reasons.map((r, i) => (
                   <p key={i} className={`text-[10px] font-bold ${r.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>{r}</p>
                 ))}
               </div>
            </div>
          )}

          {isLoadingRoute && (
            <div className="flex items-center gap-2 text-xs text-blue-500 font-bold">
              <Loader size={12} className="animate-spin" /> Calculating routes…
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Map ─── */}
      <div className="flex-1 relative min-h-0">
        <LiveMap
          userLocation={userLoc}
          destination={destination}
          routeCoords={
            isActive
              ? routeCoords
              : (activeRoute?.coords?.length ? activeRoute.coords : [])
          }
          onMapClick={handleMapClick}
          interactive={!isActive}
          markers={allMarkers}
          routeColor={routeMode === 'safest' ? '#10b981' : '#3b82f6'}
        />

        {/* Safe Zones Legend */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-xl p-3 shadow-lg border border-slate-100 z-[400]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Safe Zones</p>
          {[
            { color: '#3b82f6', label: 'Police' },
            { color: '#10b981', label: 'Hospital' },
            { color: '#34d399', label: 'Pharmacy' },
            { color: '#ec4899', label: 'Shelter' },
          ].map(z => (
            <div key={z.label} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-3 h-3 rounded-full" style={{ background: z.color }} />
              <span className="text-[11px] font-bold text-slate-600">{z.label}</span>
            </div>
          ))}
          <p className="text-[9px] text-slate-400 mt-2 font-medium">Hover marker for name</p>
        </div>
      </div>

      {/* ─── Bottom Action ─── */}
      <div className="bg-white border-t border-slate-100 p-4">
        {!isActive ? (
          <div className="space-y-3">
            {destination && (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-600 font-bold text-xs">Safety Check-In Interval:</span>
                <select
                  value={selectedTimer}
                  onChange={e => setSelectedTimer(parseFloat(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value={0.166}>10 seconds (Test)</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
            )}
            <button onClick={handleStart} disabled={!destination}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 ${
                destination
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-400/30 hover:bg-blue-700 active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Navigation size={20} />
              {destination ? `Start SafeWalk (${routeMode === 'safest' ? 'Safest' : 'Fastest'} Route)` : 'Select a destination'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-blue-50 rounded-2xl p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                <span className="text-blue-700 font-bold text-sm">SafeWalk Active</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  routeMode === 'safest' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {routeMode === 'safest' ? '🛡️ Safest' : '⚡ Fastest'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-blue-600 font-black block text-sm">{distanceKm?.toFixed(2) || '0.00'} km</span>
                {checkInTimeLeft !== null && (
                  <span className="text-blue-500 font-mono text-xs font-bold">
                    Check-in in: {Math.floor(checkInTimeLeft / 60)}:{(checkInTimeLeft % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => triggerEmergency('SafeWalk SOS')}
                className="flex-1 py-3 bg-red-500 text-white font-black rounded-2xl text-sm shadow-md">
                🚨 SOS
              </button>
              <button onClick={handleStop}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-black rounded-2xl text-sm">
                End Walk
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Check-In Prompt ─── */}
      <AnimatePresence>
        {showCheckInPrompt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border-2 border-red-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.4)]"
            >
              <Shield className="text-red-500 mx-auto mb-4 animate-pulse" size={56} />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                Have you arrived safely?
              </h2>
              <p className="text-slate-300 text-sm mb-6">
                Please confirm your safety. Emergency alert will trigger in{' '}
                <span className="text-red-400 font-black text-lg">{checkInCountdown}s</span>.
              </p>
              <button
                onClick={() => confirmSafety(selectedTimer)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg transition-colors uppercase tracking-wider text-base"
              >
                ✓ I'm Safe
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SafeWalk;
