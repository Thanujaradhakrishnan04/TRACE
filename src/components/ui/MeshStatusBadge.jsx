import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Cpu } from 'lucide-react';
import { p2pMeshService } from '../../services/p2pMeshService';

const MeshStatusBadge = () => {
  const [meshState, setMeshState] = useState({ isOnline: true, meshActive: false, nearbyNodes: 0 });

  useEffect(() => {
    // Initialize once
    p2pMeshService.init();
    
    // Subscribe to changes
    const unsubscribe = p2pMeshService.subscribe((state) => {
      setMeshState(state);
    });

    return () => unsubscribe();
  }, []);

  if (meshState.isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/50 border border-blue-500/30 rounded-full shadow-lg backdrop-blur-md">
        <Wifi size={14} className="text-blue-400" />
        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Network Online</span>
      </div>
    );
  }

  return (
    <motion.div 
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/60 border border-amber-500/50 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)] backdrop-blur-md"
    >
      <div className="relative">
        <WifiOff size={14} className="text-amber-400" />
        <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest leading-none">
          Zero-Network Active
        </span>
        <span className="text-[8px] font-semibold text-amber-200/80 uppercase mt-0.5 flex items-center gap-1">
          <Cpu size={8} />
          {meshState.nearbyNodes > 0 ? `${meshState.nearbyNodes} P2P Node(s) Linked` : 'Scanning for Nodes...'}
        </span>
      </div>
    </motion.div>
  );
};

export default MeshStatusBadge;
