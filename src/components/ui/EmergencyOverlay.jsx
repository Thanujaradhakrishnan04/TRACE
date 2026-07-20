import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MapPin, Radio, ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { useStore } from '../../context/useStore';
import FloatingChatWidget from '../chat/FloatingChatWidget';

const EmergencyOverlay = () => {
  const { isEmergencyMode, emergencyData, cancelEmergency, countdown, sendEmergencyAlert } = useStore();
  const [activeTimer, setActiveTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (isEmergencyMode) {
      setActiveTimer(0);
      interval = setInterval(() => {
        setActiveTimer(c => c + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isEmergencyMode]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSendLocation = () => {
    if (useStore.getState().countdownTimer) {
      clearInterval(useStore.getState().countdownTimer);
    }
    sendEmergencyAlert('Manual SOS - Send Location Override');
  };

  return (
    <AnimatePresence>
      {/* Pre-Emergency Countdown Modal */}
      {countdown !== null && !isEmergencyMode && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20">
              <motion.div 
                className="h-full bg-amber-500"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: countdown, ease: "linear" }}
              />
            </div>
            
            <AlertTriangle size={64} className="text-amber-500 mx-auto mb-4 animate-pulse" />
            
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase tracking-tight">
              Emergency Detected
            </h2>
            
            <p className="text-slate-300 font-medium mb-6">
              Potential distress identified. Alerts will be sent automatically in <span className="text-amber-400 font-black text-xl">{countdown}s</span>.
            </p>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={handleSendLocation}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 text-lg uppercase tracking-wider"
              >
                <MapPin size={24} />
                Send Location Now
              </button>
              
              <button 
                onClick={cancelEmergency}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg uppercase tracking-wider"
              >
                <ShieldCheck size={24} className="text-emerald-400" />
                I'm Safe
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Full Emergency Mode Overlay */}
      {isEmergencyMode && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] pointer-events-none"
        >
          {/* Flashing Red Border */}
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 border-[12px] border-red-600 pointer-events-none z-10"
          />

          {/* Dark Red Overlay */}
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md pointer-events-auto flex flex-col items-center justify-center p-6 text-center">
            
            <button 
              onClick={cancelEmergency} 
              className="absolute top-8 right-8 p-3 bg-red-900/50 rounded-full text-white hover:bg-red-800 transition-colors border border-red-500/30"
            >
              <X size={24} />
            </button>

            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(220,38,38,0.8)] mb-8"
            >
              <ShieldAlert size={64} className="text-white" />
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-black text-white tracking-widest uppercase mb-2 drop-shadow-lg">
              EMERGENCY MODE ACTIVATED
            </h1>
            <p className="text-red-300 font-bold tracking-widest text-lg uppercase mb-12">
              {emergencyData?.reason || 'SOS Triggered'}
            </p>

            {/* Live Tracking Panel */}
            <div className="bg-black/40 backdrop-blur-md border border-red-500/30 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-1/2 h-full bg-white shadow-[0_0_15px_white]"
                />
              </div>

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-widest text-sm">
                  <Radio size={18} className="animate-pulse" />
                  Live Tracking Active
                </div>
                <div className="text-3xl font-black text-white font-mono">
                  {formatTime(activeTimer)}
                </div>
              </div>

              {/* Police Dispatch Simulation */}
              {emergencyData?.assignedOfficer ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-900/40 border border-blue-500/50 rounded-xl p-4 flex items-center gap-4 text-left"
                >
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{emergencyData.assignedOfficer}</h3>
                    <p className="text-blue-300 font-semibold text-sm">ETA: <span className="text-white animate-pulse">{emergencyData.eta}</span></p>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-left">
                    <h3 className="text-white font-bold">Dispatching Nearest Authorities</h3>
                    <p className="text-red-300 text-sm">Please remain calm...</p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-red-400 text-sm font-bold uppercase tracking-widest animate-pulse">
              <MapPin size={16} className="inline mr-1" />
              Location actively transmitting to Guardian Network
            </p>
          </div>

          {/* Floating Chat Widget — renders on top of emergency overlay */}
          <FloatingChatWidget />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmergencyOverlay;
