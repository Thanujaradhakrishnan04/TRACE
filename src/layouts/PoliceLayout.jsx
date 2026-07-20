import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Map, BellRing, MessageSquare, Crosshair } from 'lucide-react';

const PoliceLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/police/home', icon: <BellRing size={24} />, label: 'Feed' },
    { path: '/police/map', icon: <Map size={24} />, label: 'Tactical Map' },
    { path: '/police/tactical', icon: <Crosshair size={24} />, label: 'Command' },
    { path: '/police/chat', icon: <MessageSquare size={24} />, label: 'Chat' }
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* Tactical Top Bar */}
      <div className="bg-slate-900 px-4 sm:px-6 py-3 sm:py-4 border-b-4 border-primary-red flex justify-between items-center shadow-lg z-20 sticky top-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-red-500/20 p-1.5 sm:p-2 rounded-full">
            <ShieldAlert className="text-primary-red" size={20} />
          </div>
          <span className="text-white font-extrabold tracking-wider text-sm sm:text-lg">COMMAND CENTER</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right">
            <div className="text-[11px] sm:text-xs text-slate-400 font-bold tracking-wider">UNIT 7A</div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400 font-bold animate-pulse tracking-widest">ON DUTY</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 border-2 border-primary-red"></div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Desktop Sidebar / Tablet Navigation */}
        <div className="hidden md:flex w-20 bg-white border-r border-slate-200 shadow-sm flex-col items-center py-8 z-10 flex-shrink-0">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <div 
                key={idx}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center cursor-pointer mb-10 relative w-full ${
                  isActive ? 'text-primary-red' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-1 bg-primary-red shadow-[0_0_10px_rgba(225,29,72,0.5)] rounded-r-md"></div>
                )}
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-red-50' : 'bg-transparent'}`}>
                  {item.icon}
                </div>
                <span className="text-[9px] font-bold mt-2 uppercase tracking-wider">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0 min-w-0">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex justify-around items-center shadow-2xl z-50">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center py-1 px-3 rounded-lg transition-colors ${
                  isActive ? 'text-primary-red bg-red-500/10' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center">
                  {React.cloneElement(item.icon, { size: 18 })}
                </div>
                <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PoliceLayout;
