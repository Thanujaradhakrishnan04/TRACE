import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, doc, setDoc, addDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useStore } from '../../context/useStore';
import {
  MessageSquare, Search, Send, User, Shield, Phone, Mail,
  Clock, ShieldAlert, AlertTriangle, RefreshCw, Wifi, WifiOff
} from 'lucide-react';

const PoliceChat = () => {
  const { isSocketConnected, currentUser, socket } = useStore();
  
  // State
  const [citizens, setCitizens] = useState([]);
  const [backendCitizens, setBackendCitizens] = useState([]);
  const [useBackendFallback, setUseBackendFallback] = useState(false);
  const [rulesBlocked, setRulesBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [citizenEmergencyId, setCitizenEmergencyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [policeProfileRegistered, setPoliceProfileRegistered] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const messagesEndRef = useRef(null);

  // Self-register police profile to satisfy isPolice() security rule
  useEffect(() => {
    const registerPoliceProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            name: user.displayName || 'Police Dispatcher',
            email: user.email,
            role: 'police',
            updatedAt: Date.now()
          }, { merge: true });
          console.log('[Firestore] Self-registered police profile document successfully.');
        } catch (err) {
          console.warn('[Firestore] Police self-registration warning:', err.message);
        } finally {
          setPoliceProfileRegistered(true);
        }
      } else {
        setPoliceProfileRegistered(true);
      }
    };
    registerPoliceProfile();
  }, []);

  // Fetch / Listen to Citizens
  useEffect(() => {
    if (!policeProfileRegistered) return;
    setLoading(true);

    // 1. Direct Firestore subscription
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = [];
      snapshot.forEach((doc) => {
        const u = { uid: doc.id, ...doc.data() };
        if (u.role === 'citizen') {
          usersList.push(u);
        }
      });
      setCitizens(usersList);
      setRulesBlocked(false);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore rules blocked direct user list retrieval:", err.message);
      setRulesBlocked(true);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [policeProfileRegistered, retryCount]);

  // Backend Fallback Fetch
  useEffect(() => {
    if (rulesBlocked) {
      const fetchCitizensFromBackend = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;
          const token = await user.getIdToken();
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
          const res = await fetch(`${backendUrl}/api/police/citizens`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.citizens)) {
              setBackendCitizens(data.citizens);
              setUseBackendFallback(true);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch citizens from backend:", err.message);
        }
      };
      fetchCitizensFromBackend();
    } else {
      setUseBackendFallback(false);
    }
  }, [rulesBlocked]);

  // Combine display list of citizens
  const displayCitizens = useBackendFallback ? backendCitizens : citizens;

  // Filter citizens list
  const filteredCitizens = displayCitizens.filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.phone || '').toLowerCase().includes(s)
    );
  });

  // Find active emergency for the selected citizen & auto-join that room
  useEffect(() => {
    if (!selectedCitizen) {
      setCitizenEmergencyId(null);
      return;
    }

    const q = query(
      collection(db, 'emergencies'),
      where('userId', '==', selectedCitizen.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let activeId = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'active' || data.status === 'dispatched') {
          activeId = docSnap.id;
        }
      });
      setCitizenEmergencyId(activeId);

      // Auto-join the emergency chat room as police
      if (activeId && socket) {
        socket.emit('join_emergency_chat', { alertId: activeId, role: 'police' });
      }
    }, (err) => {
      console.warn("Failed to query citizen emergencies:", err.message);
    });

    return () => {
      unsub();
      // Leave the previous room when switching citizens
      if (citizenEmergencyId && socket) {
        socket.emit('leave_emergency_chat', { alertId: citizenEmergencyId });
      }
    };
  }, [selectedCitizen, socket]);

  // Listen to Selected Citizen's Messages in Real-Time
  useEffect(() => {
    if (!selectedCitizen) {
      setMessages([]);
      return;
    }

    const unsubMessages = onSnapshot(
      collection(db, 'users', selectedCitizen.uid, 'messages'),
      (snapshot) => {
        const msgList = [];
        snapshot.forEach((doc) => {
          msgList.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by timestamp
        msgList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(msgList);
      },
      (err) => {
        console.error("Error listening to selected citizen's messages:", err);
      }
    );

    return () => unsubMessages();
  }, [selectedCitizen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message — writes to Firestore AND sends via WebSocket
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedCitizen || !inputVal.trim()) return;

    const textToSend = inputVal.trim();
    setInputVal('');

    try {
      const user = auth.currentUser;
      const senderName = currentUser?.name || user?.displayName || 'Police Dispatcher';
      
      const newMsg = {
        senderId: user?.uid || 'police_dispatcher',
        senderName: senderName,
        senderRole: 'police',
        recipientId: selectedCitizen.uid,
        text: textToSend,
        timestamp: Date.now()
      };

      // 1. Write to Firestore so messages persist
      await addDoc(collection(db, 'users', selectedCitizen.uid, 'messages'), newMsg);

      // 2. Also send via WebSocket to the citizen's emergency room for real-time delivery
      if (socket && citizenEmergencyId) {
        socket.emit('send_emergency_message', {
          alertId: citizenEmergencyId,
          text: textToSend,
          senderName: senderName,
          senderRole: 'police'
        });
      }
    } catch (err) {
      console.error("Failed to send message to Firestore:", err);
      alert("Failed to send message: " + err.message);
    }
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white flex flex-col">
      {/* Top Operations Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-red-950 border-b border-red-900/50 px-5 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <MessageSquare size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-widest uppercase text-white">Tactical Communication</h1>
            <p className="text-[10px] text-red-400/80 font-bold tracking-wider">CITIZEN PROTOCOL • DIRECT CHAT UPLINK</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {isSocketConnected ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-red-400 animate-pulse" />}
            <span className="text-[10px] font-bold text-slate-400">{isSocketConnected ? 'UPLINK ACTIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Citizen List */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search registered citizens..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/30"
              />
            </div>
          </div>

          {/* Database Alert Warning */}
          {rulesBlocked && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[10px] text-amber-300">
              <div className="flex items-center gap-1 font-bold">
                <AlertTriangle size={11} className="text-amber-400" />
                DATABASE POLICY APPLIED
              </div>
              <p className="mt-0.5 text-slate-400">Using backend connection fallback to fetch citizens list.</p>
            </div>
          )}

          {/* Citizen List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                <RefreshCw size={20} className="animate-spin text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Syncing database...</span>
              </div>
            ) : filteredCitizens.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <User size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">No citizens found</p>
              </div>
            ) : (
              filteredCitizens.map((c) => {
                const isSelected = selectedCitizen?.uid === c.uid;
                return (
                  <button
                    key={c.uid}
                    onClick={() => setSelectedCitizen(c)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${
                      isSelected
                        ? 'bg-red-500/10 border border-red-500/30 text-white'
                        : 'hover:bg-slate-800/40 border border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0 relative">
                      {c.profileImage ? (
                        <img src={c.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <User size={18} className={isSelected ? 'text-red-400' : 'text-slate-500'} />
                      )}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {c.name || 'Not Registered'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{c.email || c.phone || '—'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div className="flex-1 bg-slate-950 flex flex-col">
          {selectedCitizen ? (
            <>
              {/* Selected User Header */}
              <div className="bg-slate-900/60 px-6 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    {selectedCitizen.profileImage ? (
                      <img src={selectedCitizen.profileImage} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <User size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white">{selectedCitizen.name}</h2>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium mt-0.5">
                      <span className="flex items-center gap-1"><Phone size={10} /> {selectedCitizen.phone || '—'}</span>
                      <span className="flex items-center gap-1"><Mail size={10} /> {selectedCitizen.email || '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] font-black text-emerald-400 tracking-wider">ACTIVE LINK</span>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <MessageSquare size={36} className="mb-2 opacity-20" />
                    <p className="text-xs font-bold">No messages. Type a message below to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isPolice = m.senderRole === 'police';
                    return (
                      <div
                        key={m.id || i}
                        className={`flex flex-col ${isPolice ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 border ${
                            isPolice
                              ? 'bg-red-500/10 border-red-500/30 text-white rounded-br-none'
                              : 'bg-slate-900 border-slate-800 text-slate-200 rounded-bl-none'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                              isPolice ? 'text-red-400' : 'text-blue-400'
                            }`}>
                              {isPolice ? 'Officer' : selectedCitizen.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {m.timestamp ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed break-words">{m.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/60 border-t border-slate-800 flex gap-2">
                <input
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder={`Send direct message to ${selectedCitizen.name}...`}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim()}
                  className="px-5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <Shield size={48} className="text-slate-800 mb-4 animate-pulse" />
              <h3 className="text-sm font-black tracking-widest uppercase text-slate-500">Secure Dispatch Uplink</h3>
              <p className="text-xs text-slate-600 mt-1.5">Select a registered citizen from the sidebar to establish communications.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PoliceChat;
