import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, ShieldAlert, Navigation, User, Bell, Menu, X, Shield, PhoneCall, Settings, Eye, LogOut, Users, MessageSquare } from 'lucide-react';
import { useStore } from '../context/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingChatWidget from '../components/chat/FloatingChatWidget';
import AISnapshotModule from '../components/emergency/AISnapshotModule';

const CitizenLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout, isEmergencyMode, threatLevel, activeEmergencyId } = useStore();

  const navItems = [
    { path: '/citizen/home', icon: Home, label: 'Home' },
    { path: '/citizen/tracking', icon: Navigation, label: 'Routes' },
    { path: '/citizen/sos', icon: ShieldAlert, label: 'SOS', isSOS: true },
    { path: '/citizen/alerts', icon: Bell, label: 'Alerts' },
    { path: '/citizen/profile', icon: User, label: 'Profile' },
  ];

  const sidebarItems = [
    { icon: Home, label: 'Home', path: '/citizen/home' },
    { icon: Navigation, label: 'SafeWalk', path: '/citizen/tracking' },
    { icon: ShieldAlert, label: 'Emergency SOS', path: '/citizen/sos' },
    { icon: Bell, label: 'Alerts History', path: '/citizen/alerts' },
    { icon: MessageSquare, label: 'Police Chat', path: '/citizen/chat' },
    { icon: PhoneCall, label: 'Contacts', path: '/citizen/contacts' },
    { icon: Users, label: 'Guardians', path: '/citizen/guardians' },
    { icon: Eye, label: 'Evidence Vault', path: '/citizen/vault' },
    { icon: Settings, label: 'Settings', path: '/citizen/settings' },
    { icon: User, label: 'Profile', path: '/citizen/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Bar */}
      <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b z-30 ${isEmergencyMode ? 'bg-red-600 border-red-700' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-2 rounded-xl transition-colors ${isEmergencyMode ? 'text-white hover:bg-red-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Menu size={22} />
          </button>
          <div>
            <h1 className={`text-base font-black tracking-wider ${isEmergencyMode ? 'text-white' : 'text-slate-800'}`}>STREET SENTINEL</h1>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isEmergencyMode ? 'text-red-200 animate-pulse' : 'text-slate-400'}`}>
              {isEmergencyMode ? '⚠ EMERGENCY ACTIVE' : 'AI Guardian Active'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isEmergencyMode ? 'bg-white' : threatLevel === 'HIGH' || threatLevel === 'CRITICAL' ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <button onClick={() => navigate('/citizen/settings')} className={`p-2 rounded-xl ${isEmergencyMode ? 'text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Active Chat Uplink Banner */}
      {isEmergencyMode && activeEmergencyId && location.pathname !== '/citizen/chat' && (
        <div 
          onClick={() => navigate('/citizen/chat')}
          className="bg-blue-600 cursor-pointer animate-pulse px-4 py-2 flex items-center justify-between text-white font-extrabold text-xs tracking-wide shadow-lg border-b border-blue-700 hover:bg-blue-500 transition-colors z-20 flex-shrink-0"
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            🚨 SECURE CHAT UPLINK ESTABLISHED WITH POLICE DISPATCH
          </span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-black">Open Chat ➔</span>
        </div>
      )}

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl z-50 flex flex-col">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <Shield size={28} className="text-red-400" />
                  <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <h2 className="text-white font-black text-xl">STREET SENTINEL</h2>
                <p className="text-slate-400 text-sm font-bold mt-1">{currentUser?.name || 'Citizen'}</p>
                <p className="text-slate-500 text-xs">{currentUser?.email || ''}</p>
              </div>
              <div className="flex-1 overflow-y-auto py-3">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button key={item.path}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`w-full px-5 py-3.5 flex items-center gap-4 font-semibold text-sm transition-colors ${active ? 'bg-red-50 text-red-600 border-r-4 border-red-500' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                      <Icon size={19} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 text-red-500 font-bold hover:bg-red-50 transition-colors">
                <LogOut size={19} /> Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </div>

      {/* Floating Police Chat Widget */}
      <FloatingChatWidget />

      {/* Headless AI Snapshot Module */}
      <AISnapshotModule />

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white border-t border-slate-100 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex justify-around items-center px-2 pt-2 pb-4 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            if (item.isSOS) {
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="-translate-y-4 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/50 border-4 border-white active:scale-95 transition-transform">
                  <Icon size={26} className="text-white" />
                </button>
              );
            }
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-colors ${active ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon size={22} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CitizenLayout;
