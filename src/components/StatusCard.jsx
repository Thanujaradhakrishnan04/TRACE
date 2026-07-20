import React from 'react';
import { Activity, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

export const StatusCard = ({ isMonitoring, decibels }) => {
  // Convert negative dBFS (-100 to 0) to positive dBSPL-like scale (0 to 100)
  const displayDb = Math.max(0, Math.min(100, Math.round(decibels + 100)));

  return (
    <div className="glass-panel p-6 rounded-2xl w-full max-w-md mx-auto mt-4 shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Activity size={20} className={isMonitoring ? 'text-primary-red' : 'text-slate-400'} />
          Live Monitoring
        </h4>
        {isMonitoring && (
          <span className="flex items-center gap-1 text-xs font-medium text-primary-red bg-red-100 px-2 py-1 rounded-full">
            <motion.div
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 rounded-full bg-primary-red"
            />
            Listening
          </span>
        )}
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Mic size={16} /> Ambient Noise Level
          </span>
          <span className="text-sm font-bold text-slate-700">{displayDb} dB</span>
        </div>
        
        {/* Decibel Meter Bar */}
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-primary-red"
            animate={{ width: `${displayDb}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          />
        </div>
        
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
          <span>Quiet</span>
          <span>Normal</span>
          <span>Loud</span>
          <span className="text-primary-red font-semibold">Danger</span>
        </div>
      </div>
      
      {!isMonitoring && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-sm font-medium text-slate-500">Protection Mode Offline</span>
        </div>
      )}
    </div>
  );
};
