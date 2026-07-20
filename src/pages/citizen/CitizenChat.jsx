import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useStore } from '../../context/useStore';
import { MessageSquare, Send, Shield, User, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CitizenChat = () => {
  const { currentUser, socket, emergencyChats, updateEmergencyChatReadStatus, activeEmergencyId } = useStore();
  const navigate = useNavigate();
  const [latestEmergency, setLatestEmergency] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [firestoreMessages, setFirestoreMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // 1. Fetch latest emergency session for this citizen in real-time
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'emergencies'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const emergencies = [];
      snapshot.forEach((docSnap) => {
        emergencies.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      // Sort by timestamp desc to get latest
      emergencies.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });

      if (emergencies.length > 0) {
        setLatestEmergency(emergencies[0]);
      }
    }, (err) => {
      console.error("Error querying emergencies:", err);
    });

    return () => unsub();
  }, []);

  // 2. Listen to Firestore messages subcollection (from PoliceChat writes)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'messages'),
      (snapshot) => {
        const msgList = [];
        snapshot.forEach((docSnap) => {
          msgList.push({ id: docSnap.id, ...docSnap.data(), source: 'firestore' });
        });
        // Sort by timestamp ascending
        msgList.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
          return timeA - timeB;
        });
        setFirestoreMessages(msgList);
      },
      (err) => {
        console.error("Error listening to citizen messages:", err);
      }
    );

    return () => unsub();
  }, []);

  const alertId = latestEmergency?.id || activeEmergencyId;
  const socketMessages = alertId ? (emergencyChats[alertId] || []) : [];

  // 3. Merge Firestore + Socket messages, deduplicate, sort by time
  const messages = useMemo(() => {
    const allMessages = [];
    const seen = new Set();

    // Add socket messages
    for (const m of socketMessages) {
      const key = `${m.timestamp}_${m.text}_${m.senderId || m.senderRole}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMessages.push(m);
      }
    }

    // Add firestore messages (avoiding duplicates)
    for (const m of firestoreMessages) {
      const key = `${m.timestamp}_${m.text}_${m.senderId || m.senderRole}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMessages.push(m);
      }
    }

    // Sort by timestamp ascending
    allMessages.sort((a, b) => {
      const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
      const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
      return timeA - timeB;
    });
    return allMessages;
  }, [socketMessages, firestoreMessages]);

  // 4. Manage WebSocket room lifecycle & read receipts
  useEffect(() => {
    if (!socket || !alertId || latestEmergency?.status === 'resolved') return;

    // Room join is handled globally by the store; just send read receipts here
    socket.emit('message_read', { alertId });
    updateEmergencyChatReadStatus(alertId);

    // Send read receipt on incoming messages while this page is open
    const onMsg = (msg) => {
      if (msg.alertId === alertId) {
        socket.emit('message_read', { alertId });
        updateEmergencyChatReadStatus(alertId);
      }
    };

    socket.on('receive_emergency_message', onMsg);

    return () => {
      // Don't leave the room — store manages that globally
      socket.off('receive_emergency_message', onMsg);
    };
  }, [socket, alertId, latestEmergency?.status, updateEmergencyChatReadStatus]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message — send via BOTH socket AND Firestore for reliability
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const textToSend = inputVal.trim();
    setInputVal('');

    const user = auth.currentUser;

    // Send via WebSocket if available
    if (socket && alertId) {
      socket.emit('send_emergency_message', {
        alertId,
        text: textToSend,
        senderName: currentUser?.name || 'Citizen',
        senderRole: 'citizen'
      });
    }

    // Also write to own Firestore messages subcollection so police can see it
    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'messages'), {
          senderId: user.uid,
          senderName: currentUser?.name || 'Citizen',
          senderRole: 'citizen',
          text: textToSend,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn("Failed to write citizen message to Firestore:", err);
      }
    }
  };

  return (
    <div className="bg-slate-900 h-full text-slate-100 flex flex-col">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/citizen/home')} 
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
              <Shield size={16} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider">Police Dispatcher</h1>
              <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Direct Secure Line
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
            <MessageSquare size={36} className="mb-3 opacity-20 text-red-400" />
            <h2 className="text-sm font-black text-slate-300">Direct Police Chat</h2>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              This is a secure connection to the duty police officer. Send a message to report a local safety concern.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderRole === 'citizen';
            return (
              <div
                key={m.id || i}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 border ${
                    isMe
                      ? 'bg-red-500/10 border-red-500/20 text-white rounded-br-none'
                      : 'bg-slate-800 border-slate-700/60 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-wider ${
                      isMe ? 'text-red-300' : 'text-blue-300'
                    }`}>
                      {isMe ? 'You' : (m.senderName || 'Officer')}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">
                      {m.timestamp ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed break-words">{m.text}</p>
                  {isMe && (
                    <div className="text-[9px] text-right mt-0.5">
                      {m.status === 'read' ? (
                        <span className="text-emerald-400 font-extrabold">✓✓ Read</span>
                      ) : (
                        <span className="text-slate-400">✓ Sent</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form — always active for direct police messaging */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Type message to dispatcher..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/40"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="px-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CitizenChat;
