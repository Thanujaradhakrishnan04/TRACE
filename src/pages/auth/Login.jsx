import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Fingerprint, ScanFace, CheckCircle2, ArrowLeft, Camera, Globe, Mail, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const role = queryParams.get('role') || 'citizen';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    
    setScanning(true);
    setError('');

    try {
      // Sign in using Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch user profile from Firestore to verify role
      const userRef = doc(db, 'users', user.uid);
      let userData = null;
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          userData = userSnap.data();
        }
      } catch (dbErr) {
        console.warn("Firestore user read failed during login. Using default fallback:", dbErr.message);
      }

      if (!userData) {
        userData = { role: role, name: 'Citizen' };
      }
      
      // Verification of role matching
      const targetRole = userData.role || 'citizen';
      if (targetRole !== role) {
        throw new Error(`Access denied. This account is registered as ${targetRole.toUpperCase()}.`);
      }

      setScanning(false);
      setSuccess(true);
      
      setTimeout(() => {
        navigate(`/${targetRole}/home`);
      }, 1000);

    } catch (err) {
      setScanning(false);
      setError(err.message || "Failed to log in. Please check your credentials.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-red-500 opacity-[0.03] rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-slate-800 opacity-[0.03] rounded-full blur-[100px]"></div>

      {scanning && (
        <motion.div 
          initial={{ top: 0, opacity: 0 }}
          animate={{ top: '100%', opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] z-50"
        />
      )}

      {/* Centered Premium Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-[450px] bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-200/50 rounded-[2rem] p-8 relative z-10 border border-slate-100 border-t-4 ${
          role === 'police' ? 'border-t-red-500' : role === 'admin' ? 'border-t-slate-800' : 'border-t-blue-500'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/role-selection')} className="p-2 bg-slate-50 rounded-full shadow-sm hover:bg-slate-100 transition-colors border border-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4 relative">
            <div className={`p-6 rounded-full relative z-10 ${scanning ? 'animate-pulse bg-red-50' : 'bg-slate-50 border border-slate-100'}`}>
              {success ? (
                <CheckCircle2 size={48} className="text-emerald-500" />
              ) : role === 'police' ? (
                <ScanFace size={48} className={scanning ? 'text-red-500' : 'text-slate-400'} />
              ) : (
                <Fingerprint size={48} className={scanning ? 'text-red-500' : 'text-slate-400'} />
              )}
            </div>
            {scanning && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-red-500 animate-ping opacity-20"></div>
            )}
          </div>
          
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{role} ACCESS</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Authenticate Identity</p>
        </div>

        {!scanning && !success ? (
          <form onSubmit={handleLogin} className="w-full space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-500 border border-red-100 text-sm font-bold rounded-xl text-center">{error}</div>}
            
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-center text-slate-700"
            />

            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-center text-slate-700"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button 
              type="submit"
              className={`w-full py-4 mt-2 rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5 cursor-pointer ${
                role === 'police' 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200' 
                  : role === 'admin'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
              }`}
            >
              Sign In
            </button>
            <div className="text-center mt-6">
              <button type="button" onClick={() => navigate(`/signup?role=${role}`)} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                New user? Register Profile
              </button>
            </div>
          </form>
        ) : success ? (
          <div className="text-center py-4">
            <p className="text-emerald-500 font-bold tracking-widest text-lg">ACCESS GRANTED</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="animate-pulse text-red-500 font-bold tracking-widest">VERIFYING IDENTITY...</p>
          </div>
        )}
      </motion.div>

      {/* Official Footer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center relative z-10"
      >
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Official Indian Police Network</p>
        <div className="flex items-center justify-center gap-4">
          <a href="#" className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 hover:shadow-md transition-all border border-slate-100">
            <Camera size={18} />
          </a>
          <a href="#" className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 hover:shadow-md transition-all border border-slate-100">
            <Globe size={18} />
          </a>
          <a href="#" className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 hover:shadow-md transition-all border border-slate-100">
            <Mail size={18} />
          </a>
        </div>
        <p className="text-slate-400 text-[10px] mt-4 font-medium uppercase">Secured by StreetSentinel AI © 2026</p>
      </motion.div>
    </div>
  );
};

export default Login;
