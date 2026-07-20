import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Mic, MapPin, Wifi, Bell, Mail, Database, ShieldAlert, Heart } from 'lucide-react';
import { useStore } from '../../context/useStore';
import { motion } from 'framer-motion';
import { Capacitor, registerPlugin } from '@capacitor/core';

const BackgroundProtection = registerPlugin('BackgroundProtection');

const SystemHealth = () => {
  const navigate = useNavigate();
  const { 
    isListening, 
    gpsActive, 
    isSocketConnected, 
    alertHistory, 
    audioLevel, 
    settings,
    rawAmplitude,
    currentThreshold,
    emailStatus: storeEmailStatus,
    lastError
  } = useStore();
  
  const [micPermission, setMicPermission] = useState('unknown');
  const [gpsPermission, setGpsPermission] = useState('unknown');
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [dbStatus, setDbStatus] = useState('CONNECTED');

  const lastAlert = alertHistory && alertHistory.length > 0 ? alertHistory[0] : null;

  // Check browser permissions dynamically
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then(status => {
        setMicPermission(status.state);
        status.onchange = () => setMicPermission(status.state);
      }).catch(() => setMicPermission('prompt'));

      navigator.permissions.query({ name: 'geolocation' }).then(status => {
        setGpsPermission(status.state);
        status.onchange = () => setGpsPermission(status.state);
      }).catch(() => setGpsPermission('prompt'));
    } else {
      setMicPermission('unsupported');
      setGpsPermission('unsupported');
    }
  }, []);

  const getStatusColor = (status) => {
    switch (status.toUpperCase()) {
      case 'GRANTED':
      case 'ACTIVE':
      case 'CONNECTED':
      case 'ONLINE':
      case 'TRUE':
      case 'SUCCESS':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'DENIED':
      case 'ERROR':
      case 'OFFLINE':
      case 'FALSE':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'PROMPT':
      case 'PENDING':
      case 'CHECKING':
      case 'SENDING':
      case 'STANDBY':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const healthCards = [
    {
      icon: Mic,
      label: 'Microphone Monitoring',
      value: isListening ? 'Listening' : 'Standby',
      subtext: `Permission: ${micPermission.toUpperCase()} • Level: ${isListening ? Math.round(audioLevel) : -100} dB (Threshold: ${currentThreshold} dB) • Peak Amplitude: ${rawAmplitude}`,
      status: isListening ? 'ACTIVE' : 'PENDING'
    },
    {
      icon: Mail,
      label: 'Emergency Email System',
      value: storeEmailStatus || 'STANDBY',
      subtext: lastError 
        ? `Error: ${lastError}` 
        : (storeEmailStatus === 'SUCCESS' 
          ? 'Emergency email delivered successfully' 
          : (storeEmailStatus === 'SENDING' 
            ? 'Sending dispatch email...' 
            : 'Ready to send emergency emails')),
      status: storeEmailStatus || 'STANDBY'
    },
    {
      icon: MapPin,
      label: 'GPS Location',
      value: gpsActive ? 'Transmitting' : 'Inactive',
      subtext: `Permission: ${gpsPermission.toUpperCase()} • High Accuracy Active`,
      status: gpsActive ? 'ACTIVE' : 'PENDING'
    },
    {
      icon: Wifi,
      label: 'Internet Connection',
      value: navigator.onLine ? 'Online' : 'Offline',
      subtext: `Socket Link: ${isSocketConnected ? 'CONNECTED' : 'DISCONNECTED'}`,
      status: navigator.onLine ? 'ONLINE' : 'OFFLINE'
    },
    {
      icon: Bell,
      label: 'System Notifications',
      value: notifPermission === 'granted' ? 'Enabled' : 'Disabled',
      subtext: `Permission level: ${notifPermission.toUpperCase()}`,
      status: notifPermission === 'granted' ? 'ACTIVE' : 'ERROR'
    },
    {
      icon: Database,
      label: 'Database Sync (Firestore)',
      value: dbStatus,
      subtext: 'Real-time synchronization active',
      status: dbStatus
    }
  ];

  return (
    <div className="min-h-full bg-slate-50 pb-8 text-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 pt-8 pb-10 px-5 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white">System Health</h1>
              <p className="text-slate-400 text-xs font-bold mt-0.5">Real-time diagnostics dashboard</p>
            </div>
          </div>
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <Heart size={20} className="text-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Monitoring Mode Banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
          isListening 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-100' 
            : 'bg-slate-105 text-slate-700 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isListening ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
              <Activity size={20} className={isListening ? 'animate-pulse' : ''} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">System State</p>
              <h2 className="text-base font-bold">{isListening ? 'Monitoring Mode Active' : 'Disarmed / Standby'}</h2>
            </div>
          </div>
          <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
            isListening ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-750'
          }`}>
            {isListening ? 'Armed' : 'Inactive'}
          </span>
        </div>
        {/* Health status list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {healthCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4"
              >
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 flex-shrink-0">
                  <Icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{card.label}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getStatusColor(card.status)}`}>
                      {card.value}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1 leading-snug">{card.subtext}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Battery Optimization Block */}
        {Capacitor.isNativePlatform() && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Background Battery Optimization</h3>
              <p className="text-slate-500 text-xs mt-1 leading-snug">
                Exempt StreetSentinel from battery optimization to ensure the background protection service is never killed by the OS.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await BackgroundProtection.requestBatteryOptimizationExemption();
                  if (res.status === 'already_exempt') {
                    alert("App is already exempt from battery optimization.");
                  } else if (res.status === 'requested') {
                    alert("Battery optimization exemption settings opened.");
                  } else {
                    alert("Battery optimization request not supported on this platform.");
                  }
                } catch (e) {
                  console.error("Failed to request battery exemption:", e);
                }
              }}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center self-start"
            >
              Request Exemption
            </button>
          </div>
        )}

        {/* Last Alert Block */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-3">Last Threat Status</h3>
          {lastAlert ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{lastAlert.type || 'Emergency'}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{new Date(lastAlert.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-600">
                {lastAlert.riskLevel || 'CRITICAL'}
              </span>
            </div>
          ) : (
            <p className="text-slate-400 text-sm font-medium">No alerts recorded in this session. Status stable.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
