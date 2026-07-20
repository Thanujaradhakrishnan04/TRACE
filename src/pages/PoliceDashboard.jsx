import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, MapPin, Navigation, Radio, Clock, CheckCircle2,
  AlertTriangle, Users, Activity, Shield, PhoneCall, Wifi, WifiOff, Eye
} from 'lucide-react';
import LiveMap from '../components/map/LiveMap';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../context/useStore';

const STATUS_COLORS = {
  active:     { bg: 'bg-red-500/10 border-red-500/40',     text: 'text-red-400',    dot: 'bg-red-500',     label: 'ACTIVE' },
  dispatched: { bg: 'bg-amber-500/10 border-amber-500/40', text: 'text-amber-400',  dot: 'bg-amber-500',   label: 'DISPATCHED' },
  resolved:   { bg: 'bg-emerald-500/10 border-emerald-400/40', text: 'text-emerald-400', dot: 'bg-emerald-500', label: 'RESOLVED' },
};

export const PoliceDashboard = () => {
  const [alerts, setAlerts]         = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [stats, setStats]           = useState({ active: 0, dispatched: 0, resolved: 0 });
  const [isFeedOpen, setIsFeedOpen] = useState(false);

  const { socket, isSocketConnected, emergencyChats, updateEmergencyChatReadStatus } = useStore();
  const [chatAlertId, setChatAlertId] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // Connect to Firestore emergencies in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'emergencies'), (snapshot) => {
      const alertList = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        alertList.push({
          id: docSnap.id,
          threatType: data.reason || 'SOS Alert',
          timestamp: data.timestamp?.seconds ? data.timestamp.seconds * 1000 : (data.timestamp || Date.now()),
          lat: data.location?.lat,
          lng: data.location?.lng,
          userName: data.userName || 'Unknown Citizen',
          mapsLink: data.mapsLink,
          status: data.status || 'active',
          userId: data.userId
        });
      });
      // Sort by timestamp descending
      alertList.sort((a, b) => b.timestamp - a.timestamp);
      setAlerts(alertList);

      // Keep selectedAlert in sync with database updates
      if (selectedAlert) {
        const updatedSelected = alertList.find(a => a.id === selectedAlert.id);
        if (updatedSelected) {
          setSelectedAlert(updatedSelected);
        }
      }
    });

    return () => unsub();
  }, [selectedAlert]);

  // Keep WebSocket room and read status in sync
  useEffect(() => {
    if (!socket || !chatAlertId) return;

    // Join WebSocket chat room
    socket.emit('join_emergency_chat', { alertId: chatAlertId, role: 'police' });

    // Mark current messages as read
    socket.emit('message_read', { alertId: chatAlertId });
    updateEmergencyChatReadStatus(chatAlertId);

    // Periodically send read status or on incoming messages
    const onMsg = (msg) => {
      if (msg.alertId === chatAlertId) {
        socket.emit('message_read', { alertId: chatAlertId });
        updateEmergencyChatReadStatus(chatAlertId);
      }
    };

    socket.on('receive_emergency_message', onMsg);

    return () => {
      socket.emit('leave_emergency_chat', { alertId: chatAlertId });
      socket.off('receive_emergency_message', onMsg);
    };
  }, [socket, chatAlertId, updateEmergencyChatReadStatus]);

  // Keep stats in sync
  useEffect(() => {
    setStats({
      active:     alerts.filter(a => a.status === 'active').length,
      dispatched: alerts.filter(a => a.status === 'dispatched').length,
      resolved:   alerts.filter(a => a.status === 'resolved').length,
    });
  }, [alerts]);

  const handleDispatch = async (id) => {
    try {
      await updateDoc(doc(db, 'emergencies', id), { status: 'dispatched' });
    } catch (err) {
      console.error("Failed to update status to dispatched:", err);
    }
  };

  const handleResolve = async (id) => {
    try {
      await updateDoc(doc(db, 'emergencies', id), { status: 'resolved' });
    } catch (err) {
      console.error("Failed to update status to resolved:", err);
    }
  };

  const mapMarkers = alerts
    .filter(a => a.lat && a.lng && a.status !== 'resolved')
    .map(a => ({
      lat:   a.lat,
      lng:   a.lng,
      color: a.status === 'active' ? '#ef4444' : '#f59e0b',
      name:  `${a.threatType} — ${a.userName}`,
      type: 'emergency',
      userName: a.userName,
      threatType: a.threatType,
      formattedTime: new Date(a.timestamp).toLocaleTimeString(),
      status: a.status,
      onClick: () => {
        setSelectedAlert(a);
      },
      onOpenChat: () => {
        setSelectedAlert(a);
        setChatAlertId(a.id);
      }
    }));

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">

      {/* ─── Stats Bar ─── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-2.5 flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-6">
        {/* Toggle Feed Button (Mobile Only) */}
        <button 
          onClick={() => setIsFeedOpen(!isFeedOpen)} 
          className="md:hidden px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-red-400 transition-all flex items-center gap-1.5"
        >
          <Radio size={12} className={stats.active > 0 ? "animate-pulse" : ""} />
          <span className="text-[10px] font-black uppercase tracking-wider">Feed</span>
        </button>

        {/* Connection */}
        <div className="flex items-center gap-2">
          {isSocketConnected
            ? <><Wifi size={14} className="text-emerald-400" /><span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Live Feed</span></>
            : <><WifiOff size={14} className="text-red-400 animate-pulse" /><span className="text-red-400 text-xs font-black uppercase tracking-widest">Disconnected</span></>
          }
        </div>

        <div className="hidden sm:block w-px h-5 bg-slate-700" />

        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: 'Active',     value: stats.active,     color: 'text-red-400' },
            { label: 'En Route',   value: stats.dispatched, color: 'text-amber-400' },
            { label: 'Resolved',   value: stats.resolved,   color: 'text-emerald-400' },
            { label: 'Total',      value: alerts.length,    color: 'text-slate-300' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`text-sm md:text-xl font-black tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto hidden md:flex text-slate-500 text-[10px] font-bold uppercase tracking-widest items-center gap-1">
          <Clock size={11} /> {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ─── Main Grid ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Alert Feed (mobile slide-over / desktop sidebar) ─── */}
        <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden transform transition-transform duration-300 md:relative md:translate-x-0 ${
          isFeedOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}>
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Radio size={14} className="text-red-400 animate-pulse" /> Incident Feed
            </h2>
            <div className="flex items-center gap-2">
              {stats.active > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  {stats.active} NEW
                </span>
              )}
              <button onClick={() => setIsFeedOpen(false)} className="md:hidden p-1 text-slate-400 hover:text-white rounded">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence>
              {alerts.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-48 text-slate-600">
                  <Shield size={40} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold">No active emergencies</p>
                  <p className="text-xs mt-1">Area is secure</p>
                </motion.div>
              ) : (
                alerts.map(alert => {
                  const st = STATUS_COLORS[alert.status] || STATUS_COLORS.active;
                  const isSelected = selectedAlert?.id === alert.id;
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => setSelectedAlert(alert)}
                      className={`rounded-xl p-3 border cursor-pointer transition-all ${st.bg} ${
                        isSelected ? 'ring-2 ring-white/20' : 'hover:ring-1 hover:ring-white/10'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot} ${alert.status === 'active' ? 'animate-ping' : ''}`} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${st.text}`}>{st.label}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 flex-shrink-0 tabular-nums">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-white font-black text-xs mb-1 leading-snug">{alert.threatType}</p>
                      <p className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                        <Users size={9} /> {alert.userName}
                      </p>

                      {alert.lat && (
                        <p className="text-slate-500 text-[10px] font-mono flex items-center gap-1 mb-3">
                          <MapPin size={9} /> {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                        </p>
                      )}

                      {/* Action Buttons */}
                      {alert.status === 'active' && (
                        <div className="flex gap-2">
                          <button onClick={e => { e.stopPropagation(); handleDispatch(alert.id); }}
                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1">
                            <Navigation size={10} /> Dispatch
                          </button>
                          {alert.mapsLink && (
                            <a href={alert.mapsLink} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="w-8 h-7 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-colors">
                              <Eye size={12} />
                            </a>
                          )}
                        </div>
                      )}
                      {alert.status === 'dispatched' && (
                        <button onClick={e => { e.stopPropagation(); handleResolve(alert.id); }}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1">
                          <CheckCircle2 size={10} /> Mark Resolved
                        </button>
                      )}
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── Map & Chat (center/right) ─── */}
        <div className="flex-1 flex flex-row overflow-hidden">
          
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Selected Alert Detail Banner */}
            <AnimatePresence>
              {selectedAlert && (
                <motion.div
                  initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
                  className="bg-red-950/80 border-b border-red-900 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 z-10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={18} className="text-red-400 animate-pulse flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-black text-sm truncate">{selectedAlert.threatType}</p>
                      <p className="text-red-300 text-[10px]">
                        {selectedAlert.userName} · {new Date(selectedAlert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                    {selectedAlert.status !== 'resolved' && (
                      <button onClick={() => setChatAlertId(selectedAlert.id)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg text-[10px] flex items-center gap-1 transition-colors">
                        💬 Chat
                      </button>
                    )}
                    {selectedAlert.status === 'active' && (
                      <button onClick={() => handleDispatch(selectedAlert.id)}
                        className="px-2.5 py-1.5 bg-amber-500 text-slate-900 font-black rounded-lg text-[10px] flex items-center gap-1 hover:bg-amber-400 transition-colors">
                        <Navigation size={10} /> Dispatch
                      </button>
                    )}
                    {selectedAlert.status === 'dispatched' && (
                      <button onClick={() => handleResolve(selectedAlert.id)}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white font-black rounded-lg text-[10px] flex items-center gap-1 hover:bg-emerald-500 transition-colors">
                        <CheckCircle2 size={10} /> Resolve
                      </button>
                    )}
                    {selectedAlert.mapsLink && (
                      <a href={selectedAlert.mapsLink} target="_blank" rel="noreferrer"
                        className="px-2.5 py-1.5 bg-slate-700 text-white font-black rounded-lg text-[10px] flex items-center gap-1 hover:bg-slate-600 transition-colors">
                        <MapPin size={10} /> Map
                      </a>
                    )}
                    <button onClick={() => setSelectedAlert(null)}
                      className="px-2.5 py-1.5 bg-slate-800 text-slate-400 font-bold rounded-lg text-[10px] hover:bg-slate-700 transition-colors">
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Map */}
            <div className="flex-1 relative">
              <button onClick={() => setIsFeedOpen(true)}
                className="md:hidden absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur text-white px-3.5 py-2 rounded-xl border border-red-500/50 shadow-lg flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <Radio size={14} className="text-red-400 animate-pulse" /> Incident Feed
                {stats.active > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{stats.active}</span>}
              </button>
              <LiveMap
                center={selectedAlert?.lat ? [selectedAlert.lat, selectedAlert.lng] : [13.0827, 80.2707]}
                zoom={selectedAlert ? 15 : 12}
                interactive={true}
                markers={mapMarkers}
              />

              {/* Map Overlay — Legend */}
              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3 text-xs space-y-1.5 z-[400]">
                <p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-2">Map Legend</p>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" /><span className="text-slate-300 font-bold">Active SOS</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-slate-300 font-bold">Unit Dispatched</span></div>
              </div>

              {/* Empty Map State */}
              {mapMarkers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
                  <div className="bg-slate-900/80 backdrop-blur rounded-2xl p-6 text-center border border-slate-700">
                    <Activity size={32} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-white font-black">Area Secure</p>
                    <p className="text-slate-400 text-xs mt-1">No active emergencies on map</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Side Drawer */}
          {chatAlertId && selectedAlert && (
            <div className="w-full sm:w-80 absolute sm:relative right-0 inset-y-0 border-l border-slate-800 bg-slate-900 flex flex-col h-full overflow-hidden z-20">
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div>
                  <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">Secure Chat Link</h3>
                  <p className="text-[10px] text-red-400 font-bold tracking-tight">Citizen: {selectedAlert.userName}</p>
                </div>
                <button 
                  onClick={() => setChatAlertId(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(emergencyChats[chatAlertId] || []).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-8">
                    <span className="text-xl">💬</span>
                    <p className="text-[11px] font-bold mt-2">Chat Link Established</p>
                    <p className="text-[9px] max-w-[150px] mt-0.5">Send a message to contact the citizen.</p>
                  </div>
                ) : (
                  (emergencyChats[chatAlertId] || []).map((msg, i) => {
                    const isMe = msg.senderRole === 'police';
                    return (
                      <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs border ${
                          isMe ? 'bg-blue-600/10 border-blue-500/20 text-white' : 'bg-slate-800 border-slate-700 text-slate-100'
                        }`}>
                          <div className="flex justify-between gap-3 text-[8px] opacity-60 mb-0.5 font-bold uppercase">
                            <span>{msg.senderName}</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="leading-snug break-words">{msg.text}</p>
                          {isMe && (
                            <div className="text-[9px] text-right mt-0.5">
                              {msg.status === 'read' ? (
                                <span className="text-emerald-400 font-extrabold">✓✓ Read</span>
                              ) : (
                                <span className="text-slate-400">✓ Sent</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/20">
                {selectedAlert.status === 'resolved' ? (
                  <div className="text-center text-[10px] text-slate-400 font-bold py-2 bg-slate-800/40 rounded-lg border border-slate-800">
                    🔒 Chat closed (Emergency resolved)
                  </div>
                ) : (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatInput.trim() || !socket) return;
                      const text = chatInput.trim();
                      setChatInput('');
                      socket.emit('send_emergency_message', {
                        alertId: chatAlertId,
                        text,
                        senderName: 'Command Duty Officer',
                        senderRole: 'police'
                      });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type message to citizen..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-xs font-bold transition-all text-white"
                    >
                      Send
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
