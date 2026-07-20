import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, MapPin, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, ShieldCheck, Mail, Droplet } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useStore } from '../../context/useStore';
import FaceScanner from '../../components/auth/FaceScanner';

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const role = queryParams.get('role') || 'citizen';

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    bloodGroup: '',
    password: '',
    role: role,
    profileImage: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      setError("Please fill in Name, Email, Phone, and Password");
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Strong password policy: min 8 chars, uppercase, lowercase, number, special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 8 characters with uppercase, lowercase, number, and special character.");
      return;
    }

    setError('');
    setStep(2);
  };

  const handleCapture = async (imageUrl) => {
    const finalData = { ...formData, profileImage: imageUrl };
    setFormData(finalData);
    submitRegistration(finalData);
  };

  const submitRegistration = async (finalData) => {
    setLoading(true);
    setError('');
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, finalData.email, finalData.password);
      const user = userCredential.user;

      // 2. Save User Profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        name: finalData.name,
        email: finalData.email,
        phone: finalData.phone,
        address: finalData.address || '',
        bloodGroup: finalData.bloodGroup || '',
        role: finalData.role,
        profileImage: finalData.profileImage || '',
        registeredAt: new Date().toISOString()
      });

      // 3. Initialize default settings document in Firestore
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'default');
      await setDoc(settingsRef, {
        mic: true,
        gps: true,
        notifications: true,
        emailAlerts: true,
        whatsappAlerts: true,
        nightMode: true
      });

      setTimeout(() => {
        navigate(finalData.role === 'police' ? '/police/home' : '/citizen/home');
      }, 1000);
      
    } catch (err) {
      console.error("Registration failed:", err.code);
      
      let friendlyError = "Registration failed. Please try again.";
      if (err.code === 'auth/email-already-in-use') {
        friendlyError = "This email is already registered. Please use a different email or go to the Login page.";
      } else if (err.code === 'auth/operation-not-allowed') {
        friendlyError = "Email/Password sign-in is not enabled. Please contact the administrator.";
      } else if (err.code === 'auth/weak-password') {
        friendlyError = "Password is too weak. Please use a stronger password.";
      }
      
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-red-500 opacity-[0.03] rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-500 opacity-[0.03] rounded-full blur-[100px]"></div>

      {/* Centered Premium Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[450px] bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-200/50 rounded-[2rem] p-8 relative z-10 border border-slate-100"
      >
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => step === 2 ? setStep(1) : navigate('/role-selection')} className="p-2 bg-slate-50 rounded-full shadow-sm hover:bg-slate-100 transition-colors border border-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <span className="text-xs font-black tracking-widest text-slate-300">STEP {step} OF 2</span>
        </div>

        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-50 rounded-2xl">
              <ShieldCheck size={32} className="text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">STREET SENTINEL</h1>
          <p className="text-red-500 text-xs font-bold uppercase tracking-widest mt-1">{role === 'police' ? 'Police Registration' : 'AI Powered Urban Safety'}</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6">
            {step === 1 ? 'Create Profile' : 'Biometric Scan'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {step === 1 
              ? 'Enter your details to establish a secure link.' 
              : 'Look directly at the camera to register your identity.'}
          </p>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {error && <div className="p-3 bg-red-50 text-red-500 border border-red-100 text-sm font-bold rounded-xl text-center">{error}</div>}
                
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" name="name" value={formData.name} onChange={handleChange}
                    placeholder="Full Legal Name" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="Email Address" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    placeholder="Mobile Phone Number" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
                    placeholder="Create Secure Password" 
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" name="address" value={formData.address} onChange={handleChange}
                    placeholder="Home Address" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="relative">
                  <Droplet className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}
                    placeholder="Blood Group (e.g., O+)" 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <button 
                  onClick={handleNext}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-4 bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-700 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  Proceed to Verification <ArrowRight size={20} />
                </button>
                <div className="text-center mt-6">
                  <button type="button" onClick={() => navigate(`/login?role=${role}`)} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                    Already have an account? Sign In
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center"
              >
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <h3 className="mt-4 font-bold text-slate-800">Registering Profile...</h3>
                  </div>
                ) : (
                  <FaceScanner onCapture={handleCapture} />
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
