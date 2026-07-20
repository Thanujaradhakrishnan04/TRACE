import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Shield, ChevronDown } from 'lucide-react';
import { useStore } from '../../context/useStore';

const FloatingChatWidget = () => {
  const {
    socket,
    activeEmergencyId,
    isEmergencyMode,
    emergencyChats,
    currentUser,
    updateEmergencyChatReadStatus
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const alertId = activeEmergencyId;
  const messages = alertId ? (emergencyChats[alertId] || []) : [];

  // Auto-open when first police message arrives
  useEffect(() => {
    if (!alertId) return;
    const msgs = emergencyChats[alertId] || [];
    const policeMessages = msgs.filter(m => m.senderRole === 'police');
    if (policeMessages.length > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [emergencyChats, alertId]);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!alertId) return;
    const msgs = emergencyChats[alertId] || [];
    const unreadPoliceMessages = msgs.filter(m => m.senderRole === 'police' && m.status !== 'read');

    if (!isOpen) {
      setUnreadCount(unreadPoliceMessages.length);
    } else {
      setUnreadCount(0);
      if (unreadPoliceMessages.length > 0) {
        if (socket) {
          socket.emit('message_read', { alertId });
        }
        updateEmergencyChatReadStatus(alertId);
      }
    }
  }, [emergencyChats, alertId, isOpen, socket, updateEmergencyChatReadStatus]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isOpen]);

  // Send message
  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !socket || !alertId) return;
    const text = inputVal.trim();
    setInputVal('');
    socket.emit('send_emergency_message', {
      alertId,
      text,
      senderName: currentUser?.name || 'Citizen',
      senderRole: 'citizen'
    });
  };

  // Don't render if no active emergency
  if (!isEmergencyMode || !alertId) return null;

  return (
    <>
      {/* Chat Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: '96px',
              right: '16px',
              width: '360px',
              maxHeight: 'calc(100vh - 140px)',
              zIndex: 99999
            }}
            className="flex flex-col bg-slate-900 rounded-2xl border border-blue-500/30 shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Shield size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-xs uppercase tracking-wider">Police Dispatch</h3>
                  <p className="text-blue-200 text-[9px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Secure Line Active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: '180px', maxHeight: '320px' }}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8 text-center">
                  <MessageSquare size={28} className="mb-2 opacity-20 text-blue-400" />
                  <p className="text-[11px] font-bold text-slate-400">Secure Chat Link Active</p>
                  <p className="text-[9px] text-slate-500 max-w-[180px] mt-1">
                    Send a message or wait for the police dispatcher to contact you.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.senderRole === 'citizen';
                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs border ${
                        isMe
                          ? 'bg-blue-600/20 border-blue-500/20 text-white rounded-br-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-100 rounded-bl-sm'
                      }`}>
                        <div className="flex items-center justify-between gap-3 mb-0.5">
                          <span className={`text-[8px] font-black uppercase tracking-wider ${
                            isMe ? 'text-blue-300' : 'text-amber-300'
                          }`}>
                            {isMe ? 'You' : 'Officer'}
                          </span>
                          <span className="text-[7px] text-slate-500 font-mono">
                            {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="leading-snug break-words">{m.text}</p>
                        {isMe && (
                          <div className="text-[8px] text-right mt-0.5">
                            {m.status === 'read' ? (
                              <span className="text-emerald-400 font-bold">✓✓</span>
                            ) : (
                              <span className="text-slate-500">✓</span>
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

            {/* Input */}
            <form onSubmit={handleSend} className="p-2.5 border-t border-slate-800 flex gap-2 bg-slate-950/50 flex-shrink-0">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type message..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center"
              >
                <Send size={13} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '16px',
          zIndex: 99999
        }}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${
          isOpen
            ? 'bg-slate-700 shadow-slate-900/50'
            : 'bg-blue-600 shadow-blue-500/40 hover:bg-blue-500'
        }`}
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <>
            <MessageSquare size={22} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-lg">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </motion.button>
    </>
  );
};

export default FloatingChatWidget;
