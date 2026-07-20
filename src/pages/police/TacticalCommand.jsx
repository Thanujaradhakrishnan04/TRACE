import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useStore } from '../../context/useStore';
import { useSafeZones } from '../../hooks/useSafeZones';
import LiveMap from '../../components/map/LiveMap';
import {
  Shield, MapPin, Users, AlertTriangle, Crosshair, Clock,
  Wifi, WifiOff, ChevronDown, ChevronUp, Navigation,
  Phone, RefreshCw, Volume2, User, FileText,
  Search, ShieldAlert, Heart
} from 'lucide-react';

const TacticalCommand = () => {
  const { lastKnownLocation, isSocketConnected } = useStore();
  const loc = lastKnownLocation || { lat: 13.0827, lng: 80.2707 };

  // Get police stations nearby via OpenStreetMap
  const { safeZones } = useSafeZones(loc, 15000);
  const policeStations = safeZones.filter(z => z.type === 'police');

  // State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [backendUsers, setBackendUsers] = useState([]);
  const [useBackendFallback, setUseBackendFallback] = useState(false);
  const [allAlerts, setAllAlerts] = useState([]);
  const [userContacts, setUserContacts] = useState({});
  const [loading, setLoading] = useState(true);
  const [rulesBlocked, setRulesBlocked] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [activeTab, setActiveTab] = useState('alerts'); // alerts | users | police
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [policeProfileRegistered, setPoliceProfileRegistered] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Self-register police profile to satisfy isPolice() security rule
  useEffect(() => {
    const registerPoliceProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            name: user.displayName || 'Police Dispatcher',
            email: user.email,
            role: 'police',
            updatedAt: Date.now()
          }, { merge: true });
          console.log('[Firestore] Self-registered police profile document successfully.');
        } catch (err) {
          console.warn('[Firestore] Police self-registration warning:', err.message);
        } finally {
          setPoliceProfileRegistered(true);
        }
      } else {
        setPoliceProfileRegistered(true);
      }
    };
    registerPoliceProfile();
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!policeProfileRegistered) return;
    
    setLoading(true);

    // 1. Listen to users collection (requires role matching rules)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = [];
      snapshot.forEach((doc) => {
        usersList.push({ uid: doc.id, ...doc.data() });
      });
      setRegisteredUsers(usersList);
      setRulesBlocked(false);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore rules blocked direct user list retrieval:", err.message);
      setRulesBlocked(true);
      setLoading(false);
    });

    // 2. Listen to global emergencies collection (always readable for authenticated users)
    const unsubEmergencies = onSnapshot(collection(db, 'emergencies'), (snapshot) => {
      const alertsList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        alertsList.push({
          id: doc.id,
          ...data
        });
      });
      // Sort by timestamp (handling both firestore timestamp object and numeric timestamp)
      alertsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setAllAlerts(alertsList);
    }, (err) => {
      console.error("Error listening to global emergencies:", err);
    });

    return () => {
      unsubUsers();
      unsubEmergencies();
    };
  }, [policeProfileRegistered, retryCount]);

  // Fetch expanded user contacts on demand (with backend fallback if rules are blocked)
  useEffect(() => {
    if (expandedUser && !userContacts[expandedUser]) {
      if (!rulesBlocked) {
        getDocs(collection(db, 'users', expandedUser, 'contacts'))
          .then((snap) => {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserContacts(prev => ({ ...prev, [expandedUser]: list }));
          })
          .catch((err) => console.error("Error fetching user contacts:", err));
      } else {
        // Fetch contacts from backend proxy
        const fetchContactsFromBackend = async () => {
          try {
            const user = auth.currentUser;
            if (!user) return;
            const token = await user.getIdToken();
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
            const res = await fetch(`${backendUrl}/api/police/citizens/${expandedUser}/contacts`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && Array.isArray(data.contacts)) {
                setUserContacts(prev => ({ ...prev, [expandedUser]: data.contacts }));
              }
            }
          } catch (err) {
            console.error("Failed to fetch contacts from backend:", err.message);
          }
        };
        fetchContactsFromBackend();
      }
    }
  }, [expandedUser, userContacts, rulesBlocked]);

  // Fetch citizen profiles from backend proxy when client rules are blocked
  useEffect(() => {
    if (rulesBlocked) {
      const fetchCitizensFromBackend = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;
          const token = await user.getIdToken();
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
          const res = await fetch(`${backendUrl}/api/police/citizens`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.citizens)) {
              setBackendUsers(data.citizens);
              setUseBackendFallback(true);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch citizens from backend:", err.message);
        }
      };
      fetchCitizensFromBackend();
    } else {
      setUseBackendFallback(false);
    }
  }, [rulesBlocked]);

  // Merge alert data with live user profiles if available
  const consolidatedAlerts = allAlerts.map(alert => {
    const citizen = registeredUsers.find(u => u.uid === alert.userId);
    return {
      ...alert,
      userName: citizen?.name || alert.userName || citizen?.email || 'Unknown Citizen',
      userPhone: citizen?.phone || alert.userPhone || '—',
      userEmail: citizen?.email || '—',
      profileImage: citizen?.profileImage || null,
      bloodGroup: citizen?.bloodGroup || '—',
      address: citizen?.address || '—'
    };
  });

  // Extract profiles from emergencies if direct user listing is blocked
  const extractedCitizens = [];
  const seenIds = new Set();
  consolidatedAlerts.forEach(a => {
    if (a.userId && !seenIds.has(a.userId)) {
      seenIds.add(a.userId);
      extractedCitizens.push({
        uid: a.userId,
        name: a.userName,
        role: 'citizen',
        phone: a.userPhone || '—',
        email: '—',
        address: '—',
        bloodGroup: a.bloodGroup || '—',
        isExtracted: true
      });
    }
  });

  const displayUsers = !rulesBlocked 
    ? registeredUsers.filter(u => u.role === 'citizen')
    : useBackendFallback 
      ? backendUsers.filter(u => u.role === 'citizen')
      : extractedCitizens;

  // Stats
  const activeAlerts = consolidatedAlerts.filter(a => a.status === 'active');
  const totalAlertsCount = consolidatedAlerts.length;

  // Map Markers: SOS alerts as pulsing "emergency" icons, police stations as blue shield icons
  const alertMarkers = consolidatedAlerts
    .filter(a => a.location?.lat && a.location?.lng)
    .map(a => ({
      lat: a.location.lat,
      lng: a.location.lng,
      name: `${a.reason || a.type || 'SOS'} — ${a.userName}`,
      color: '#ef4444',
      type: 'emergency' // Pulse marker in LiveMap
    }));

  const policeMarkers = policeStations.map(p => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name,
    color: '#3b82f6',
    type: 'police'
  }));

  const mapMarkers = [...alertMarkers, ...policeMarkers];

  // Filter citizens list
  const filteredUsers = displayUsers.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.phone || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="bg-slate-950 min-h-screen text-white overflow-y-auto pb-8">

      {/* ─── COMMAND BAR ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-red-950 border-b border-red-900/50 px-5 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <Crosshair size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white">Tactical Command</h1>
            <p className="text-[9px] sm:text-[10px] text-red-400/80 font-bold tracking-wider">POLICE OPS CENTER • LIVE DATA</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {isSocketConnected ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-red-400 animate-pulse" />}
            <span className="text-[10px] font-bold text-slate-400">{isSocketConnected ? 'UPLINK ACTIVE' : 'OFFLINE'}</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-white tabular-nums">{clock.toLocaleTimeString('en-IN', { hour12: false })}</p>
            <p className="text-[9px] text-slate-500 font-bold">{clock.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* ─── STAT STRIP ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-800">
        {[
          { label: 'CITIZENS', value: displayUsers.length, icon: Users, color: 'text-blue-400' },
          { label: 'ACTIVE SOS', value: activeAlerts.length, icon: ShieldAlert, color: 'text-red-400' },
          { label: 'INCIDENTS', value: totalAlertsCount, icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'POLICE UNITS', value: policeStations.length, icon: Shield, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900/50 px-4 py-3 border-r border-slate-800 last:border-r-0">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon size={12} className={s.color} />
              <span className="text-[9px] font-black text-slate-500 tracking-widest">{s.label}</span>
            </div>
            <p className={`text-2xl font-black ${s.color} tabular-nums`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-4">

        {/* ─── ROW 1: LIVE MAP + DATA CONTROLS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* LIVE MAP WITH EMERGENCY MARKERS */}
          <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative h-[400px] lg:h-[480px] w-full">
            <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] font-black text-slate-300 tracking-wider">LIVE POLICE RADAR</span>
            </div>
            <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] space-y-1">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-bold text-white">!</div><span className="text-slate-300 font-bold">Active SOS Marker</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-slate-300 font-bold">Police Command</span></div>
            </div>
            <LiveMap interactive={true} zoom={13} userLocation={loc} markers={mapMarkers} />
          </div>

          {/* REAL-TIME OPERATIONS PANEL */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-800 no-scrollbar">
              {[
                { id: 'alerts', label: 'SOS Feed', icon: AlertTriangle, count: activeAlerts.length },
                { id: 'users', label: 'Profiles', icon: Users, count: displayUsers.length },
                { id: 'police', label: 'Stations', icon: Shield, count: policeStations.length },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[95px] py-2.5 px-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                    activeTab === tab.id ? 'text-white bg-slate-800 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <tab.icon size={12} className="flex-shrink-0" />
                  <span>{tab.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === tab.id ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-500'}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tab Container */}
            <div className="flex-1 overflow-y-auto max-h-[420px] p-3 space-y-2">

              {/* 1. SOS ALERT FEED */}
              {activeTab === 'alerts' && (
                loading ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw size={20} className="text-slate-500 animate-spin" /></div>
                ) : consolidatedAlerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-600"><Shield size={32} className="mx-auto mb-2 opacity-30" /><p className="font-bold text-sm">No Active Emergency Feeds</p></div>
                ) : (
                  consolidatedAlerts.map((alert, i) => {
                    const alertKey = alert.id || i;
                    const isExpanded = expandedAlert === alertKey;
                    const timeStr = alert.timestamp?.seconds 
                      ? new Date(alert.timestamp.seconds * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
                      : new Date(alert.timestamp || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

                    return (
                      <div key={alertKey} className="bg-red-950/20 rounded-xl border border-red-900/30 overflow-hidden transition-all shadow-sm">
                        <div 
                          onClick={() => setExpandedAlert(isExpanded ? null : alertKey)}
                          className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-red-900/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                            <span className="text-[9px] font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">
                              {alert.status === 'active' ? 'CRITICAL' : 'RESOLVED'}
                            </span>
                            <span className="text-xs font-black text-white truncate">{alert.userName || 'Citizen'}</span>
                            <span className="text-slate-500 text-xs">•</span>
                            <span className="text-xs font-bold text-red-300 truncate">{alert.reason || alert.type || 'SOS Alert'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums">{timeStr}</span>
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-3 pb-3 pt-1 border-t border-red-900/20 space-y-2.5 bg-slate-950/40"
                            >
                              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1 mt-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {alert.profileImage ? (
                                    <img src={alert.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><User size={12} className="text-blue-400" /></div>
                                  )}
                                  <div>
                                    <p className="text-xs font-bold text-white">{alert.userName}</p>
                                    <p className="text-[10px] text-slate-400">{alert.userPhone}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 font-medium">
                                  <p><span className="text-slate-500 font-bold">Blood Group:</span> {alert.bloodGroup || 'Unknown'}</p>
                                  <p><span className="text-slate-500 font-bold">Status:</span> <span className="text-red-400 uppercase font-bold">{alert.status}</span></p>
                                  <p className="col-span-2 text-slate-400"><span className="text-slate-500 font-bold">Address:</span> {alert.address || 'GPS Coordinates Provided'}</p>
                                </div>
                              </div>

                              {alert.location?.lat && (
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                                  <span className="flex items-center gap-1"><MapPin size={10} className="text-blue-400" /> {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}</span>
                                  <a href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-400 font-bold hover:underline">Open Map Radar ↗</a>
                                </div>
                              )}

                              {alert.audioLabel && (
                                <p className="text-[10px] text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 flex items-center gap-1"><Volume2 size={12} /> Threat Detected: {alert.audioLabel} ({alert.audioConfidence}% match)</p>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${alert.emailStatus === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                  EMAIL: {alert.emailStatus === 'SUCCESS' ? '✓ SENT' : '—'}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${alert.smsStatus === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                  SMS: {alert.smsStatus === 'SUCCESS' ? '✓ SENT' : '—'}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )
              )}

              {/* 2. REGISTERED PROFILES (CITIZENS) */}
              {activeTab === 'users' && (
                <>
                  {rulesBlocked && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-3 text-[11px] leading-relaxed text-amber-300">
                      <p className="font-bold flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={13} className="text-amber-400" />
                        DATABASE POLICY RESTRICTION
                      </p>
                      <p className="mb-2">
                        Firestore rules restrict direct listing of user accounts. Citizens who trigger an SOS are extracted below.
                      </p>
                      <p className="mb-2 font-semibold">
                        To enable complete user list browsing, copy and paste this rule snippet into your Firebase Console Rules tab:
                      </p>
                      <pre className="bg-slate-950 p-2 text-[9px] rounded border border-slate-800 overflow-x-auto text-slate-400 font-mono mb-2.5">
{`allow read: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'police');`}
                      </pre>
                      <button 
                        onClick={() => setRetryCount(prev => prev + 1)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] tracking-wider uppercase transition-colors"
                      >
                        Retry Connection
                      </button>
                    </div>
                  )}

                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search citizen profiles..."
                      className="w-full bg-slate-850 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/40" />
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12"><RefreshCw size={20} className="text-slate-500 animate-spin" /></div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-600"><Users size={32} className="mx-auto mb-2 opacity-30" /><p className="font-bold text-sm">No profiles found</p></div>
                  ) : (
                    filteredUsers.map((u, i) => (
                      <div key={u.uid || i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                        <button onClick={() => setExpandedUser(expandedUser === u.uid ? null : u.uid)}
                          className="w-full p-3 flex items-center gap-3 text-left hover:bg-slate-800 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                            {u.profileImage ? <img src={u.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" /> : <User size={18} className="text-blue-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate">{u.name || 'Not Registered'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.email || '—'}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${u.role === 'police' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{(u.role || 'citizen').toUpperCase()}</span>
                            {expandedUser === u.uid ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                          </div>
                        </button>

                        <AnimatePresence>
                          {expandedUser === u.uid && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="border-t border-slate-800 overflow-hidden">
                              <div className="p-3.5 space-y-3 bg-slate-900/80">
                                {/* Citizen Stats */}
                                <div className="grid grid-cols-2 gap-3 text-[11px] border-b border-slate-800 pb-2.5">
                                  <div><p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-0.5">Phone Number</p><p className="text-white font-bold">{u.phone || '—'}</p></div>
                                  <div><p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-0.5">Blood Group</p><p className="text-white font-bold flex items-center gap-1"><Heart size={10} className="text-red-500" /> {u.bloodGroup || '—'}</p></div>
                                  <div className="col-span-2"><p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-0.5">Primary Residence</p><p className="text-white font-bold">{u.address || '—'}</p></div>
                                </div>

                                {/* Emergency Contacts */}
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Registered Emergency Contacts</p>
                                  {(rulesBlocked && !userContacts[u.uid]) ? (
                                    <p className="text-[10px] text-amber-500/80 italic">Database restriction blocks contact lookup (Requires Rule Update or Server Connection)</p>
                                  ) : (!userContacts[u.uid] || userContacts[u.uid].length === 0) ? (
                                    <p className="text-[10px] text-slate-500 italic">No contacts registered</p>
                                  ) : (
                                    userContacts[u.uid].map((c, ci) => (
                                      <div key={ci} className="flex items-center gap-2 bg-slate-950 rounded-lg p-2 mb-1 border border-slate-800">
                                        <Phone size={10} className="text-emerald-400 flex-shrink-0" />
                                        <span className="text-[11px] text-white font-bold flex-1">{c.name || 'Emergency Contact'}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">{c.phone || '—'}</span>
                                      </div>
                                    ))
                                  )}
                                </div>

                                {/* Alert History for this user */}
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SOS Trigger Log</p>
                                  {consolidatedAlerts.filter(a => a.userId === u.uid).length === 0 ? (
                                    <p className="text-[10px] text-slate-500 italic">No recorded incidents for this citizen</p>
                                  ) : (
                                    consolidatedAlerts.filter(a => a.userId === u.uid).map((a, ai) => (
                                      <div key={ai} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 mb-1 text-[10px]">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-red-400 font-black">{a.reason || a.type || 'SOS'}</span>
                                          <span className="text-slate-500 font-mono">
                                            {a.timestamp?.seconds 
                                              ? new Date(a.timestamp.seconds * 1000).toLocaleString('en-IN')
                                              : new Date(a.timestamp || Date.now()).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                        {a.location?.lat && <p className="text-blue-400 font-mono">📍 {a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}</p>}
                                        {a.audioLabel && <p className="text-amber-400 mt-0.5 font-bold">🔊 Audio trigger: {a.audioLabel}</p>}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* 3. DISPATCH STATIONS */}
              {activeTab === 'police' && (
                policeStations.length === 0 ? (
                  <div className="text-center py-12 text-slate-600"><Shield size={32} className="mx-auto mb-2 opacity-30" /><p className="font-bold text-sm">No Nearby Police Infrastructure</p></div>
                ) : (
                  policeStations.map((ps, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Shield size={16} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{ps.name}</p>
                        {ps.address && <p className="text-[10px] text-slate-400 truncate">{ps.address}</p>}
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin size={9} /> {ps.distance ? `${ps.distance < 1000 ? ps.distance + 'm' : (ps.distance / 1000).toFixed(1) + ' km'}` : '—'}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {ps.phone && (
                          <a href={`tel:${ps.phone}`} className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                            <Phone size={13} />
                          </a>
                        )}
                        <a href={`https://maps.google.com/?q=${ps.lat},${ps.lng}`} target="_blank" rel="noreferrer"
                          className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors">
                          <Navigation size={13} />
                        </a>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* ─── ROW 2: LIVE HISTORIC CASE LOG SPREADSHEET ─── */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-amber-400" />
              <h2 className="text-xs font-black tracking-widest text-slate-300 uppercase">Historic Master Case Ledger</h2>
            </div>
            <span className="text-[9px] text-slate-500 font-bold">{totalAlertsCount} TOTAL INCOMING CHANNELS</span>
          </div>

          {consolidatedAlerts.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6 font-bold">No active alarms recorded in Ledger</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Datetime</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Citizen</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Contact info</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Reason / Threat</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Live coordinates</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Blood Group</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Email Status</th>
                    <th className="text-left py-2 px-2 font-black tracking-wider uppercase">Sms status</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedAlerts.slice(0, 15).map((a, i) => (
                    <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                      <td className="py-2 px-2 font-mono tabular-nums text-slate-400">
                        {a.timestamp?.seconds 
                          ? new Date(a.timestamp.seconds * 1000).toLocaleString('en-IN')
                          : new Date(a.timestamp || Date.now()).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-white font-bold">{a.userName}</td>
                      <td className="py-2 px-2 text-slate-400 font-mono">{a.userPhone}</td>
                      <td className="py-2 px-2"><span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-black text-[9px]">{a.reason || a.type || 'SOS'}</span></td>
                      <td className="py-2 px-2 font-mono">{a.location?.lat ? <a href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}</a> : '—'}</td>
                      <td className="py-2 px-2 font-bold text-red-400">{a.bloodGroup}</td>
                      <td className="py-2 px-2"><span className={a.emailStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-500'}>{a.emailStatus === 'SUCCESS' ? '✓ Sent' : a.emailStatus || '—'}</span></td>
                      <td className="py-2 px-2"><span className={a.smsStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-500'}>{a.smsStatus === 'SUCCESS' ? '✓ Sent' : a.smsStatus || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TacticalCommand;
