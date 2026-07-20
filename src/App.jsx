import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext';
import { useStore } from './context/useStore';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Auth Pages
import Splash from './pages/auth/Splash';
import Onboarding from './pages/auth/Onboarding';
import RoleSelection from './pages/auth/RoleSelection';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import AuthLanding from './pages/auth/AuthLanding';

// Citizen Pages
import CitizenLayout from './layouts/CitizenLayout';
import CitizenHome from './pages/citizen/CitizenHome';
import EmergencySOS from './pages/citizen/EmergencySOS';
import SafeWalk from './pages/citizen/SafeWalk';
import Profile from './pages/citizen/Profile';
import Settings from './pages/citizen/Settings';
import EvidenceVault from './pages/citizen/EvidenceVault';
import Alerts from './pages/citizen/Alerts';
import Contacts from './pages/citizen/Contacts';
import Guardians from './pages/citizen/Guardians';
import SystemHealth from './pages/citizen/SystemHealth';
import CitizenChat from './pages/citizen/CitizenChat';
import Diagnostics from './pages/citizen/Diagnostics';
import EmergencyOverlay from './components/ui/EmergencyOverlay';

// Police Pages
import PoliceLayout from './layouts/PoliceLayout';
import { PoliceDashboard } from './pages/PoliceDashboard';
import PoliceMap from './pages/police/PoliceMap';
import TacticalCommand from './pages/police/TacticalCommand';
import PoliceChat from './pages/police/PoliceChat';

// Admin Pages
import AdminLayout from './layouts/AdminLayout';
import AdminHome from './pages/admin/AdminHome';

// Mock Layout Placeholders
const MockDashboard = ({ role }) => <div className="flex-center" style={{height: '100vh'}}><h1 className="text-neon-blue">{role} Dashboard Placeholder</h1></div>;

function App() {
  const { isOffline, setOfflineStatus } = useStore();

  React.useEffect(() => {
    // Request Notification permission on startup
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const handleOnline = () => setOfflineStatus(false);
    const handleOffline = () => setOfflineStatus(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global Geolocation Watcher to keep lastKnownLocation fresh
    let watchId;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          useStore.setState({
            lastKnownLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            gpsActive: true
          });
        },
        (err) => console.warn('Global initial GPS error:', err),
        { enableHighAccuracy: true }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          useStore.setState({
            lastKnownLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            gpsActive: true
          });
        },
        (err) => console.warn('Global GPS watch error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [setOfflineStatus]);

  return (
    <SimulationProvider>
      <Router>
        <EmergencyOverlay />
        
        {/* Offline Mesh Network Banner */}
        <AnimatePresence>
          {isOffline && (
            <motion.div 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              exit={{ y: -50 }}
              className="fixed top-0 left-0 w-full z-[100] bg-slate-900 text-slate-300 p-2 text-center text-xs font-bold tracking-widest flex items-center justify-center gap-2 border-b border-slate-700"
            >
              <WifiOff size={14} className="text-red-500 animate-pulse" />
              OFFLINE MESH NETWORK ACTIVE
            </motion.div>
          )}
        </AnimatePresence>

        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/auth-home" element={<AuthLanding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Citizen Routes */}
          <Route path="/citizen" element={<ProtectedRoute requiredRole="citizen"><CitizenLayout /></ProtectedRoute>}>
            <Route path="home" element={<CitizenHome />} />
            <Route path="sos" element={<EmergencySOS />} />
            <Route path="tracking" element={<SafeWalk />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="guardians" element={<Guardians />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="vault" element={<EvidenceVault />} />
            <Route path="health" element={<SystemHealth />} />
            <Route path="chat" element={<CitizenChat />} />
            <Route path="diagnostics" element={<Diagnostics />} />
          </Route>

          {/* Police Routes */}
          <Route path="/police" element={<ProtectedRoute requiredRole="police"><PoliceLayout /></ProtectedRoute>}>
            <Route path="home" element={<PoliceDashboard />} />
            <Route path="map" element={<PoliceMap />} />
            <Route path="tactical" element={<TacticalCommand />} />
            <Route path="chat" element={<PoliceChat />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
            <Route path="home" element={<AdminHome />} />
            <Route path="analytics" element={<MockDashboard role="Admin Analytics" />} />
            <Route path="users" element={<MockDashboard role="Admin Users" />} />
            <Route path="heatmap" element={<MockDashboard role="Admin Map" />} />
            <Route path="settings" element={<MockDashboard role="Admin Settings" />} />
          </Route>
        </Routes>
      </Router>
    </SimulationProvider>
  );
}

export default App;
