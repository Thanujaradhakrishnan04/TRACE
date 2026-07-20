import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Mic, Bell, Smartphone, EyeOff, Save, Trash2, PhoneCall, Mail, MapPin, Moon } from 'lucide-react';
import { useStore } from '../../context/useStore';
import { motion } from 'framer-motion';

const Toggle = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-red-500' : 'bg-slate-200'}`}>
    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
  </button>
);

const SettingRow = ({ icon: Icon, label, description, checked, onChange, iconColor = 'text-slate-600' }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${checked ? 'bg-red-50' : 'bg-slate-50'}`}>
        <Icon size={18} className={checked ? 'text-red-500' : 'text-slate-500'} />
      </div>
      <div>
        <p className="font-bold text-slate-800 text-sm">{label}</p>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{description}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, logout } = useStore();

  const clearCache = () => {
    if (window.confirm('Clear all local data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 pt-8 pb-10 px-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-slate-600/20 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-slate-400" />
            <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Configuration</span>
          </div>
          <h1 className="text-3xl font-black text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Customize your safety preferences</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-5">
        {/* Protection */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">AI Protection</h3>
          <SettingRow icon={Mic} label="Voice Monitoring" description="Detect distress sounds via microphone"
            checked={settings.mic} onChange={(v) => updateSettings({ mic: v })} />
          <SettingRow icon={MapPin} label="Background GPS" description="Continuous location tracking"
            checked={settings.gps} onChange={(v) => updateSettings({ gps: v })} />
          <SettingRow icon={Moon} label="Night Safety Mode" description="Enhanced sensitivity after 8 PM"
            checked={settings.nightMode ?? true} onChange={(v) => updateSettings({ nightMode: v })} />
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Alert Channels</h3>
          <SettingRow icon={Bell} label="Push Notifications" description="Browser notifications for alerts"
            checked={settings.notifications} onChange={(v) => updateSettings({ notifications: v })} />
          <SettingRow icon={Mail} label="Email Alerts" description="Send SOS via email to contacts"
            checked={settings.emailAlerts} onChange={(v) => updateSettings({ emailAlerts: v })} />
          <SettingRow icon={Smartphone} label="WhatsApp Alerts" description="Send SOS via WhatsApp"
            checked={settings.whatsappAlerts} onChange={(v) => updateSettings({ whatsappAlerts: v })} />
        </div>

        {/* Privacy */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Privacy & Data</h3>
          <SettingRow icon={EyeOff} label="Audio Privacy" description="Do not save audio recordings"
            checked={settings.audioPrivacy ?? false} onChange={(v) => updateSettings({ audioPrivacy: v })} />
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Data & Storage</h3>
          <button onClick={() => navigate('/citizen/vault')}
            className="w-full flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-md hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <Save size={18} className="text-emerald-400" />
              <span className="font-bold text-sm">Evidence Vault</span>
            </div>
            <span className="text-slate-500 text-xs font-bold">Open →</span>
          </button>

          <button onClick={() => navigate('/citizen/contacts')}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <PhoneCall size={18} className="text-blue-500" />
              <span className="font-bold text-sm text-slate-800">Manage Contacts</span>
            </div>
            <span className="text-slate-400 text-xs font-bold">Open →</span>
          </button>

          <button onClick={() => navigate('/citizen/diagnostics')}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <Mic size={18} className="text-red-500" />
              <span className="font-bold text-sm text-slate-800">Microphone Diagnostics</span>
            </div>
            <span className="text-slate-400 text-xs font-bold">Open →</span>
          </button>

          <button onClick={clearCache}
            className="w-full flex items-center justify-center gap-2 p-4 bg-white border border-red-200 text-red-500 rounded-2xl shadow-sm hover:bg-red-50 transition-colors font-bold text-sm">
            <Trash2 size={16} /> Clear All Local Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
