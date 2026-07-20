import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/useStore';
import { AlertTriangle, Clock, MapPin, Mail, MessageCircle, ShieldOff, RefreshCw, Camera, Layers, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

const Alerts = () => {
  const { alertHistory, triggerEmergency } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const severityStyle = (level) => {
    if (level === 'CRITICAL') return 'bg-red-100 text-red-600';
    if (level === 'HIGH') return 'bg-orange-100 text-orange-600';
    return 'bg-amber-100 text-amber-600';
  };

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-red-900 pt-8 pb-10 px-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-red-400 text-xs font-black uppercase tracking-widest">Incident Log</span>
          </div>
          <h1 className="text-3xl font-black text-white">Alert History</h1>
          <p className="text-slate-400 text-sm mt-1">{alertHistory.length} incident{alertHistory.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Test Alert Button */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-800 text-sm">Test Alert System</p>
            <p className="text-slate-500 text-xs">Trigger a test to verify notifications work</p>
          </div>
          <button onClick={() => triggerEmergency('System Test Alert')}
            className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs shadow-sm">
            Test
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw size={28} className="text-slate-400 animate-spin" />
            <p className="text-slate-400 font-bold">Loading incidents...</p>
          </div>
        ) : alertHistory.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm">
            <ShieldOff size={44} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-lg">No alerts recorded</p>
            <p className="text-slate-400 text-sm mt-1">Your incident history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
              Recent Incidents
            </h2>
            {alertHistory.map((alert, i) => (
              <motion.div key={alert.id || i}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${severityStyle(alert.riskLevel)}`}>
                      {alert.riskLevel || 'ALERT'}
                    </span>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                      {alert.type || 'Emergency'}
                    </span>
                    {alert.meshRelayed && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full animate-pulse">
                        <WifiOff size={10} /> MESH NODE
                      </span>
                    )}
                  </div>
                </div>

                {/* Time & Location */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <Clock size={13} /> {new Date(alert.timestamp).toLocaleString()}
                  </div>
                  {alert.location?.lat && (
                    <a
                      href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-blue-500 text-xs font-bold hover:underline">
                      <MapPin size={13} />
                      {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)} — View on Map
                    </a>
                  )}
                  {alert.floorData?.floorLevel && (
                    <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold bg-indigo-50 px-2 py-1 rounded-lg w-max mt-1 border border-indigo-100">
                      <Layers size={13} />
                      {alert.floorData.floorLevel}
                    </div>
                  )}
                  {alert.snapshotMetadata?.hasImage && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg w-max mt-1 border border-emerald-100">
                      <Camera size={13} />
                      Snapshot Captured • AI: {alert.snapshotMetadata.aiDetection.join(', ')}
                    </div>
                  )}
                </div>

                {/* Delivery Status */}
                <div className="flex gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${alert.emailStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : alert.emailStatus === 'QUEUED_MESH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Mail size={11} /> Email {alert.emailStatus === 'SUCCESS' ? '✓' : alert.emailStatus === 'QUEUED_MESH' ? '⏳' : '—'}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${alert.smsStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : alert.smsStatus === 'QUEUED_MESH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    <MessageCircle size={11} /> WhatsApp {alert.smsStatus === 'SUCCESS' ? '✓' : alert.smsStatus === 'QUEUED_MESH' ? '⏳' : '—'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
