import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Phone, PhoneCall, MapPin, Share2, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/useStore';
import { useNavigate } from 'react-router-dom';

const EmergencySOS = () => {
  const { triggerEmergency, sendEmergencyAlert, isEmergencyMode, cancelEmergency, contacts } = useStore();
  const [pressed, setPressed] = useState(false);
  const navigate = useNavigate();

  const handleSOS = () => {
    setPressed(true);
    triggerEmergency('Manual SOS — Emergency Button');
    setTimeout(() => setPressed(false), 2000);
  };

  const handleCallPolice = () => {
    window.location.href = 'tel:100';
  };

  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        navigator.share?.({ title: 'My Location', url }) ?? window.open(url, '_blank');
        
        // Instantly fire the SendGrid email dispatch bypassing any countdown
        sendEmergencyAlert('Manual SOS — Shared Location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        // Fallback if GPS fails
        sendEmergencyAlert('Manual SOS — Shared Location (GPS Unavailable)');
      });
    } else {
      sendEmergencyAlert('Manual SOS — Shared Location (GPS Disabled)');
    }
  };

  return (
    <div className="min-h-full bg-slate-900 text-white pb-8">
      {/* Header */}
      <div className="bg-gradient-to-b from-red-600 to-red-900 px-6 pt-8 pb-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          <span className="text-red-200 text-xs font-black uppercase tracking-widest">Emergency Protocol</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">SOS CENTER</h1>
        <p className="text-red-200 text-sm mt-2">Immediate help at your fingertips</p>
      </div>

      <div className="px-5 -mt-6 space-y-4">
        {/* Big SOS Button */}
        <motion.div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl">
          <p className="text-slate-500 text-sm font-bold mb-6 uppercase tracking-widest">Hold to activate emergency</p>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onTouchStart={handleSOS}
            onClick={handleSOS}
            className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl transition-all ${
              pressed || isEmergencyMode
                ? 'bg-red-500 shadow-red-400/60'
                : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-400/40'
            }`}
          >
            <div className="absolute inset-0 rounded-full border-4 border-red-300/40 animate-ping" />
            <ShieldAlert size={52} className="text-white" />
            <span className="text-white font-black text-lg tracking-widest">SOS</span>
          </motion.button>
          <p className="text-slate-400 text-xs mt-6 text-center">
            {isEmergencyMode ? '🔴 Emergency mode active — contacts alerted' : 'This will alert all your emergency contacts immediately'}
          </p>
          {isEmergencyMode && (
            <div className="flex flex-col items-center gap-3 mt-4">
              <button onClick={() => navigate('/citizen/chat')}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 animate-pulse">
                💬 Open Police Chat
              </button>
              <button onClick={cancelEmergency}
                className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-xl text-sm">
                Cancel Emergency
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCallPolice}
            className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-3 border border-slate-700">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Phone size={22} className="text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Call Police</p>
              <p className="text-slate-500 text-xs">Dial 100</p>
            </div>
          </motion.button>

          <motion.button whileTap={{ scale: 0.95 }} onClick={handleShareLocation}
            className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-3 border border-slate-700">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <MapPin size={22} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Share Location</p>
              <p className="text-slate-500 text-xs">Send live GPS</p>
            </div>
          </motion.button>

          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/citizen/contacts')}
            className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-3 border border-slate-700">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <PhoneCall size={22} className="text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Call Contact</p>
              <p className="text-slate-500 text-xs">{contacts.length} contacts saved</p>
            </div>
          </motion.button>

          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  const msg = `🚨 EMERGENCY — I need help! My location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                });
              }
            }}
            className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-3 border border-slate-700">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <Share2 size={22} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">WhatsApp SOS</p>
              <p className="text-slate-500 text-xs">Send location</p>
            </div>
          </motion.button>
        </div>

        {/* Emergency contacts list */}
        {contacts.length > 0 && (
          <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4">Emergency Contacts</h3>
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-black">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{c.name}</p>
                      <p className="text-slate-500 text-xs">{c.relation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition((pos) => {
                            sendEmergencyAlert(`Manual SOS — Shared Location with ${c.name}`, { lat: pos.coords.latitude, lng: pos.coords.longitude });
                          });
                        }
                      }}
                      className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center" title="Send GPS">
                      <MapPin size={16} className="text-blue-400" />
                    </button>
                    <a href={`tel:${c.phone}`}
                      className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <Phone size={16} className="text-emerald-400" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contacts.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm font-semibold">
              No emergency contacts saved. <button onClick={() => navigate('/citizen/contacts')} className="underline">Add contacts</button> to enable alerts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencySOS;
