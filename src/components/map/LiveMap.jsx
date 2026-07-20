import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── Distinct SVG Icons per type ─────────────────────────────────────────────

const svgIcon = (svg, width = 32, height = 40, isPin = true) => L.divIcon({
  className: 'custom-div-icon',
  html: svg,
  iconSize: [width, height],
  iconAnchor: isPin ? [width / 2, height] : [width / 2, height / 2],
  popupAnchor: isPin ? [0, -height + 10] : [0, -height / 2],
});

const pin = (color, inner) => `<svg viewBox="0 0 32 40" width="32" height="40"><path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#fff" stroke-width="2"/><g transform="translate(5, 5) scale(0.78)">${inner}</g></svg>`;

const ICONS = {
  police: svgIcon(pin('#3b82f6', `<path d="M14 5l5 6h-3v6h-4v-6H9l5-6z" fill="#fff"/><rect x="11" y="19" width="6" height="3" rx="1.5" fill="#fff"/>`)),
  hospital: svgIcon(pin('#ef4444', `<rect x="12" y="6" width="4" height="16" rx="1" fill="#fff"/><rect x="6" y="12" width="16" height="4" rx="1" fill="#fff"/>`)),
  clinic: svgIcon(pin('#10b981', `<rect x="12" y="6" width="4" height="16" rx="1" fill="#fff"/><rect x="6" y="12" width="16" height="4" rx="1" fill="#fff"/>`)),
  pharmacy: svgIcon(pin('#34d399', `<rect x="12" y="8" width="4" height="12" rx="1" fill="#fff"/><rect x="8" y="12" width="12" height="4" rx="1" fill="#fff"/>`)),
  womens_shelter: svgIcon(pin('#ec4899', `<path d="M14 6l7 7h-3v7h-8v-7H7l7-7z" fill="#fff"/>`)),
  user: svgIcon(`<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="13" fill="#3b82f6" stroke="#fff" stroke-width="3"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`, 28, 28, false),
  destination: svgIcon(`<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="13" fill="#0f172a" stroke="#fff" stroke-width="3"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`, 28, 28, false),
  emergency: (color = '#ef4444') => {
    // Inject the keyframes style tag if not already present
    if (!document.getElementById('map-animations')) {
      const style = document.createElement('style');
      style.id = 'map-animations';
      style.innerHTML = `
        @keyframes map-pulse-red {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
            transform: scale(0.95);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
            transform: scale(1.15);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            transform: scale(0.95);
          }
        }
        .pulse-emergency-marker {
          animation: map-pulse-red 1.5s infinite ease-in-out;
          border-radius: 50%;
        }
      `;
      document.head.appendChild(style);
    }
    return svgIcon(`<div class="pulse-emergency-marker" style="background:${color};width:26px;height:26px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-family:system-ui,-apple-system,sans-serif;font-size:15px;text-shadow:0 1px 2px rgba(0,0,0,0.4);">!</div>`, 26, 26, false);
  },
};

const userAvatarIcon = (photoUrl) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="width:36px;height:36px;border-radius:50%;border:3px solid #3b82f6;box-shadow:0 0 14px rgba(59,130,246,0.7);overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;"><img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';"/></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const getIconForType = (type, color) => {
  if (type === 'emergency') return ICONS.emergency(color);
  if (typeof ICONS[type] === 'function') return ICONS[type](color);
  if (ICONS[type]) return ICONS[type];
  // Fallback: pulse dot with color
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${color || '#64748b'};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px ${color || '#64748b'}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// ─── Map sub-components ──────────────────────────────────────────────────────

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] && center?.[1]) map.flyTo(center, map.getZoom(), { duration: 1.5 });
  }, [center, map]);
  return null;
};

const MapClickHandler = ({ onMapClick }) => {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => onMapClick?.(e.latlng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onMapClick]);
  return null;
};

const formatDist = (m) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)} km`);

// ─── Main Component ──────────────────────────────────────────────────────────

const LiveMap = ({
  center = [13.0827, 80.2707],
  zoom = 15,
  userLocation = null,
  destination = null,
  routeCoords = [],
  interactive = true,
  onMapClick = null,
  markers = [],
  routeColor = '#3b82f6',
  userAvatar = null,
}) => {
  const [autoLocation, setAutoLocation] = useState(null);

  useEffect(() => {
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setAutoLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [userLocation]);

  const activeCenter = userLocation ? [userLocation.lat, userLocation.lng] : (autoLocation || center);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-slate-100">
      <MapContainer center={activeCenter} zoom={zoom} scrollWheelZoom={interactive} dragging={interactive} zoomControl={interactive} className="w-full h-full z-0">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <MapUpdater center={activeCenter} />
        {interactive && <MapClickHandler onMapClick={onMapClick} />}

        {/* User */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userAvatar ? userAvatarIcon(userAvatar) : ICONS.user}>
            <Tooltip direction="top" offset={[0, -18]}><b>📍 You are here</b></Tooltip>
          </Marker>
        )}
        {!userLocation && autoLocation && (
          <Marker position={autoLocation} icon={userAvatar ? userAvatarIcon(userAvatar) : ICONS.user}>
            <Tooltip direction="top" offset={[0, -18]}><b>📍 You are here</b></Tooltip>
          </Marker>
        )}

        {/* Destination */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={ICONS.destination}>
            <Tooltip direction="top" offset={[0, -14]}><b>🎯 {destination.name || 'Destination'}</b></Tooltip>
          </Marker>
        )}

        {/* Route */}
        {routeCoords.length > 0 && <Polyline positions={routeCoords} color={routeColor} weight={5} opacity={0.85} />}

        {/* Safe Zone Markers — distinct icons + clickable popup */}
        {markers.map((m, i) => (
          <Marker 
            key={i} 
            position={[m.lat, m.lng]} 
            icon={getIconForType(m.type, m.color)}
            eventHandlers={{
              click: () => {
                if (m.onClick) m.onClick();
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.97}>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{m.name || 'Safety Zone'}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {m.type === 'police' ? '🛡️ Police' : m.type === 'hospital' ? '🏥 Hospital' : m.type === 'clinic' ? '🏥 Clinic' : m.type === 'pharmacy' ? '💊 Pharmacy' : m.type === 'womens_shelter' ? '🏠 Shelter' : m.label || '📍'}
                </div>
                {m.distance != null && <div style={{ fontSize: 10, color: '#94a3b8' }}>{formatDist(m.distance)}</div>}
              </div>
            </Tooltip>
            <Popup maxWidth={260} minWidth={200}>
              {m.type === 'emergency' ? (
                <div style={{ fontFamily: 'system-ui', padding: 2 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 900, color: '#e11d48', letterSpacing: '0.05em' }}>🚨 EMERGENCY BROADCAST</h3>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: 4 }}><b>Citizen:</b> {m.userName}</div>
                    <div style={{ marginBottom: 4 }}><b>Type:</b> {m.threatType || 'SOS Alert'}</div>
                    <div style={{ marginBottom: 4 }}><b>Coordinates:</b> {m.lat.toFixed(5)}, {m.lng.toFixed(5)}</div>
                    <div style={{ marginBottom: 4 }}><b>Time:</b> {m.formattedTime || new Date().toLocaleTimeString()}</div>
                    <div style={{ marginBottom: 6 }}>
                      <b>Status: </b> 
                      <span style={{ 
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 900,
                        backgroundColor: m.status === 'active' ? '#fee2e2' : '#fef3c7',
                        color: m.status === 'active' ? '#ef4444' : '#d97706',
                        textTransform: 'uppercase'
                      }}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                  {m.status !== 'resolved' && m.onOpenChat && (
                    <button 
                      onClick={() => m.onOpenChat()}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        backgroundColor: '#e11d48',
                        color: '#fff',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: 4,
                        textAlign: 'center'
                      }}
                    >
                      💬 Open Chat
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ fontFamily: 'system-ui', padding: 2 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{m.name || 'Safety Zone'}</h3>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {m.type === 'police' ? '🛡️ Police Station' : m.type === 'hospital' ? '🏥 Hospital' : m.type === 'clinic' ? '🏥 Clinic' : m.type === 'pharmacy' ? '💊 Pharmacy' : m.type === 'womens_shelter' ? '🏠 Women\'s Shelter' : '📍 Location'}
                  </p>
                  {m.distance != null && (
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#334155', fontWeight: 700 }}>📏 Distance: {formatDist(m.distance)}</p>
                  )}
                  {m.address && <p style={{ margin: '4px 0', fontSize: 11, color: '#475569' }}>📍 {m.address}</p>}
                  {m.phone && <p style={{ margin: '4px 0', fontSize: 11 }}><a href={`tel:${m.phone}`} style={{ color: '#3b82f6', fontWeight: 700 }}>📞 {m.phone}</a></p>}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 6, padding: '5px 12px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                  >
                    🧭 Navigate
                  </a>
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
export { ICONS, getIconForType };
