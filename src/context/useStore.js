import { create } from 'zustand';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, addDoc, getDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { io } from 'socket.io-client';
import { Network } from '@capacitor/network';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const speak = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SynthesisUtterance(text);
    // fallback if no voice synthesis needed
  }
};

// Safe voice synthesiser wrapper
const safeSpeak = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech Synthesis failed:", e);
    }
  }
};

const getBackendUrl = () => {
  let url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
  if (Capacitor.isNativePlatform()) {
    if (url.startsWith('/')) {
      url = 'http://10.0.2.2:4000';
    } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
      url = url.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
  }
  return url;
};

const backendUrl = getBackendUrl();

export const useStore = create((set, get) => {

  // Real-time listeners storage
  let unsubContacts = null;
  let unsubAlerts = null;
  let unsubSettings = null;
  let unsubActiveEmergency = null;

  let unsubUser = null;

  // Listen to Auth State
  onAuthStateChanged(auth, (user) => {
    // ALWAYS clean up existing listeners to prevent ghost updates from previous users
    if (unsubUser) unsubUser();
    if (unsubContacts) unsubContacts();
    if (unsubAlerts) unsubAlerts();
    if (unsubSettings) unsubSettings();
    if (unsubActiveEmergency) {
      unsubActiveEmergency();
      unsubActiveEmergency = null;
    }
    get().disconnectSocket();

    if (user) {
      const userRef = doc(db, 'users', user.uid);
      
      // Setup real-time listeners for this user (subcollections)
      get().setupListeners(user.uid);
      get().initSocket(user);

      // Listen to user document in real-time to solve race conditions during Signup
      unsubUser = onSnapshot(userRef, (userSnap) => {
        if (userSnap.exists()) {
          const userData = { uid: user.uid, ...userSnap.data() };
          set({ currentUser: userData });
        } else {
          set({ currentUser: { uid: user.uid, email: user.email, name: 'Citizen', role: 'citizen' } });
        }
      }, (err) => {
        console.warn("Firestore user fetch permission denied:", err.message);
        set({ currentUser: { uid: user.uid, email: user.email, name: 'Citizen', role: 'citizen' } });
      });

    } else {
      set({ currentUser: null, contacts: [], alertHistory: [], activeEmergencyId: null });
    }
  });

  return {
    currentUser: null,
    contacts: [],
    alertHistory: [],
    activeEmergencyId: null,
    emergencyChats: {},
    settings: {
      mic: true,
      gps: true,
      notifications: true,
      emailAlerts: true,
      whatsappAlerts: true,
    },
    socket: null,
    isSocketConnected: false,
    
    // Advanced Features State
    isMeshActive: false,
    offlineAlertQueue: [],

    // Diagnostic State
    isListening: typeof window !== 'undefined' ? localStorage.getItem('sentinel_armed') === 'true' : false,
    setIsListening: (status) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sentinel_armed', String(status));
      }
      set({ isListening: status });
    },
    rawAmplitude: 0,
    currentThreshold: -15,
    emailStatus: 'STANDBY',
    lastError: null,

    addEmergencyChatMessage: (alertId, message) => {
      set((state) => {
        const chats = { ...state.emergencyChats };
        if (!chats[alertId]) chats[alertId] = [];
        const isDuplicate = chats[alertId].some(
          m => m.timestamp === message.timestamp && m.text === message.text && m.senderId === message.senderId
        );
        if (!isDuplicate) {
          chats[alertId] = [...chats[alertId], message];
        }
        return { emergencyChats: chats };
      });
    },

    updateEmergencyChatReadStatus: (alertId) => {
      set((state) => {
        const chats = { ...state.emergencyChats };
        if (chats[alertId]) {
          chats[alertId] = chats[alertId].map(m => ({ ...m, status: 'read' }));
        }
        return { emergencyChats: chats };
      });
    },

    initSocket: async (user) => {
      const existingSocket = get().socket;
      if (existingSocket) {
        existingSocket.disconnect();
      }

      try {
        const socketHost = backendUrl.startsWith('/') 
          ? window.location.origin 
          : backendUrl.replace(/\/api$/, '');
        const token = user ? await user.getIdToken() : '';
        const socket = io(socketHost, {
          auth: { token },
          transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
          set({ isSocketConnected: true });
          // Auto-join emergency room if one is already active (handles reconnect / race condition)
          const activeId = get().activeEmergencyId;
          if (activeId) {
            socket.emit('join_emergency_chat', { alertId: activeId, role: get().currentUser?.role || 'citizen' });
          }
        });

        socket.on('disconnect', () => {
          set({ isSocketConnected: false });
        });

        socket.on('connect_error', (err) => {
          console.warn("Socket connection error:", err.message);
          set({ isSocketConnected: false });
        });

        socket.on('receive_emergency_message', (msg) => {
          get().addEmergencyChatMessage(msg.alertId, msg);

          // Trigger Notification + Speak if from police to citizen
          const curUser = get().currentUser;
          if (msg.senderRole === 'police' && curUser && curUser.role === 'citizen') {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Message from Police Command`, {
                body: msg.text,
                tag: 'emergency_chat_msg'
              });
            }
            try {
              LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'Police Command',
                    body: msg.text,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 500) }
                  }
                ]
              });
            } catch (err) { console.warn('Capacitor LocalNotifications:', err) }
            safeSpeak("New message from Police Command.");
          }
        });

        socket.on('message_read_update', (data) => {
          if (data && data.alertId) {
            get().updateEmergencyChatReadStatus(data.alertId);
          }
        });

        set({ socket });
      } catch (err) {
        console.error("Failed to initialize socket:", err);
      }
    },

    disconnectSocket: () => {
      const existingSocket = get().socket;
      if (existingSocket) {
        existingSocket.disconnect();
      }
      set({ socket: null, isSocketConnected: false });
    },

    setupListeners: (uid) => {
      // Listen for Contacts
      unsubContacts = onSnapshot(collection(db, 'users', uid, 'contacts'), (snapshot) => {
        const contactsList = [];
        snapshot.forEach((doc) => contactsList.push({ id: doc.id, ...doc.data() }));
        set({ contacts: contactsList });
      }, (err) => {
        console.warn("Failed to listen to contacts (permissions denied):", err.message);
      });

      // Listen for Alerts
      unsubAlerts = onSnapshot(collection(db, 'users', uid, 'alerts'), (snapshot) => {
        const alertsList = [];
        snapshot.forEach((doc) => alertsList.push({ id: doc.id, ...doc.data() }));
        // Sort by descending timestamp
        alertsList.sort((a, b) => b.timestamp - a.timestamp);
        set({ alertHistory: alertsList });
      }, (err) => {
        console.warn("Failed to listen to alerts (permissions denied):", err.message);
      });

      // Listen for Settings
      unsubSettings = onSnapshot(doc(db, 'users', uid, 'settings', 'default'), (docSnap) => {
        if (docSnap.exists()) {
          set({ settings: docSnap.data() });
        } else {
          // Initialize default settings
          const defaultSettings = get().settings;
          setDoc(doc(db, 'users', uid, 'settings', 'default'), defaultSettings).catch(() => { });
        }
      }, (err) => {
        console.warn("Failed to listen to settings (permissions denied):", err.message);
      });

      // Listen for active emergencies of this user
      const emergenciesRef = collection(db, 'emergencies');
      const q = query(emergenciesRef, where('userId', '==', uid));
      unsubActiveEmergency = onSnapshot(q, (snapshot) => {
        let activeId = null;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'active' || data.status === 'dispatched') {
            activeId = docSnap.id;
          }
        });

        const prevId = get().activeEmergencyId;
        const sock = get().socket;

        // Auto-leave previous room if emergency changed
        if (sock && prevId && prevId !== activeId) {
          sock.emit('leave_emergency_chat', { alertId: prevId });
        }

        // Auto-join new emergency room so citizen receives messages globally
        if (sock && activeId && activeId !== prevId) {
          sock.emit('join_emergency_chat', { alertId: activeId, role: 'citizen' });
        }

        set({ activeEmergencyId: activeId });
        if (activeId) {
          set({ isEmergencyMode: true });
        } else {
          set({ isEmergencyMode: false });
        }
      }, (err) => {
        console.warn("Failed to listen to active user emergencies:", err.message);
      });
    },

    updateSettings: async (newSettings) => {
      const uid = get().currentUser?.uid;
      if (!uid) return;
      const updated = { ...get().settings, ...newSettings };
      set({ settings: updated });
      await updateDoc(doc(db, 'users', uid, 'settings', 'default'), updated);
    },

    addContact: async (contact) => {
      const uid = get().currentUser?.uid;
      if (!uid) return;
      try {
        if (get().currentUser?.isMockUser) {
          throw new Error("Mock user mode active");
        }
        await addDoc(collection(db, 'users', uid, 'contacts'), contact);
      } catch (err) {
        console.warn("Firestore addContact failed, using local fallback:", err.message);
        const newContact = { id: 'local_' + Date.now(), ...contact };
        set({ contacts: [...get().contacts, newContact] });
      }
    },

    deleteContact: async (id) => {
      const uid = get().currentUser?.uid;
      if (!uid) return;
      try {
        if (get().currentUser?.isMockUser) {
          throw new Error("Mock user mode active");
        }
        await deleteDoc(doc(db, 'users', uid, 'contacts', id));
      } catch (err) {
        console.warn("Firestore deleteContact failed, using local fallback:", err.message);
        set({ contacts: get().contacts.filter(c => c.id !== id) });
      }
    },

    updateContact: async (id, updatedFields) => {
      const uid = get().currentUser?.uid;
      if (!uid) return;
      try {
        if (get().currentUser?.isMockUser) {
          throw new Error("Mock user mode active");
        }
        await updateDoc(doc(db, 'users', uid, 'contacts', id), updatedFields);
      } catch (err) {
        console.warn("Firestore updateContact failed, using local fallback:", err.message);
        set({
          contacts: get().contacts.map(c => c.id === id ? { ...c, ...updatedFields } : c)
        });
      }
    },

    updateUserProfile: async (updatedFields) => {
      const uid = get().currentUser?.uid;
      if (!uid) return;
      try {
        await setDoc(doc(db, 'users', uid), updatedFields, { merge: true });
        // Real-time listener will automatically pick up changes
      } catch (err) {
        console.error("Failed to update profile:", err);
        throw err;
      }
    },

    globalRouteCoords: [],
    lastKnownLocation: null,
    gpsActive: false,
    lastGpsUpdateTime: 'N/A',
    setGpsActive: (status) => set({ gpsActive: status }),
    setLastGpsUpdateTime: (timeStr) => set({ lastGpsUpdateTime: timeStr }),

    // Auth is handled by Firebase via the onAuthStateChanged listener
    setCurrentUser: (user) => set({ currentUser: user }),
    logout: async () => {
      await auth.signOut();
      set({ currentUser: null });
    },

    // AI Threat Level System
    threatLevel: 'LOW', // LOW, MEDIUM, HIGH, CRITICAL
    aiMessage: 'Sentinel AI active. Environment stable.',
    riskScore: 0,
    audioLevel: -100,
    setAudioLevel: (db) => set({ audioLevel: db }),
    setThreatLevel: (level, message) => {
      set({ threatLevel: level, aiMessage: message });
      if (message) safeSpeak(message);
    },

    // Network State
    isOffline: !navigator.onLine,
    setOfflineStatus: (status) => set({ isOffline: status }),
    setMeshActive: (status) => set({ isMeshActive: status }),

    // Emergency Mode System
    isEmergencyMode: false,
    emergencyData: null,
    countdown: null,
    countdownTimer: null,
    smsDeliveryStatus: null,
    noContactsWarning: false,   // true when SOS triggered with 0 contacts
    clearNoContactsWarning: () => set({ noContactsWarning: false }),

    triggerEmergency: (reason, audioLabel = null, audioConfidence = null) => {
      if (get().isEmergencyMode || get().countdownTimer !== null) return;

      // ─── Guard: Cooldown of 10 seconds after cancel ──────────────────────────
      if (get().lastEmergencyCancelTime && (Date.now() - get().lastEmergencyCancelTime < 10000)) {
        return;
      }

      // ─── Guard: no contacts = warn, do NOT dispatch to nobody ─────────────────
      if (get().contacts.length === 0) {
        set({ noContactsWarning: true });
        console.warn('SOS triggered but no emergency contacts configured.');
        return;
      }

      console.log('triggerEmergency called');

      set({
        threatLevel: 'CRITICAL',
        aiMessage: 'We detected a possible distress situation. Would you like to share your live location with your emergency contacts?',
        countdown: 15
      });
      safeSpeak('Potential Emergency Detected.');

      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification("StreetSentinel Alert", { 
          body: "Emergency detected! Click here if you are SAFE.",
          requireInteraction: true
        });
        notif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          get().cancelEmergency();
          notif.close();
        };
      }
      
      try {
        LocalNotifications.schedule({
          notifications: [
            {
              title: 'StreetSentinel Alert',
              body: 'Emergency detected! Open app if you are SAFE.',
              id: 999,
              schedule: { at: new Date(Date.now() + 500) }
            }
          ]
        });
      } catch (err) { console.warn('Capacitor LocalNotifications:', err) }

      if (navigator.vibrate) {
        navigator.vibrate([500, 250, 500]);
      }

      const timer = setInterval(() => {
        set((state) => {
          const nextCount = state.countdown - 1;
          if (nextCount <= 0) {
            clearInterval(timer);
            get().sendEmergencyAlert(reason, null, audioLabel, audioConfidence);
            return { countdown: null, countdownTimer: null };
          }
          return { countdown: nextCount };
        });
      }, 1000);

      set({ countdownTimer: timer });
    },

    sendEmergencyAlert: async (reason = "Manual SOS Override", forceLocation = null, audioLabel = null, audioConfidence = null, targetContact = null) => {
      console.log("Emergency escalation started");
      
      const isCurrentlyOffline = get().isOffline;

      // Immediately activate UI Emergency Mode
      set({
        countdown: null,
        countdownTimer: null,
        isEmergencyMode: true,
        isMeshActive: isCurrentlyOffline,
        emergencyData: { reason, startTime: Date.now(), assignedOfficer: null, eta: null, locationUrl: null, floorData: null },
        smsDeliveryStatus: { status: isCurrentlyOffline ? 'QUEUED_MESH' : 'PENDING' },
        aiMessage: isCurrentlyOffline ? 'OFFLINE DETECTED. Mesh Network Protocol Activated. Broadcasting SOS to nearby peers.' : 'CRITICAL ALERT. Emergency Mode Activated. Dispatching authorities.'
      });

      safeSpeak(isCurrentlyOffline ? 'Offline. Mesh Network Protocol Activated.' : 'CRITICAL ALERT. Emergency Mode Activated. Dispatching nearest authorities immediately.');

      const dispatch = async (coords) => {
        const uid = get().currentUser?.uid;
        const finalCoords = coords || get().lastKnownLocation || { lat: 12.9716, lng: 77.5946 };
        const locationUrl = `https://maps.google.com/?q=${finalCoords.lat},${finalCoords.lng}`;

        // Photo capture logic completely removed as requested
        let snapshotMetadata = { aiDetection: ['Disabled'], hasImage: false };
        let photoBase64 = null;

        // Floor Level (Mock data removed; actual altitude/barometer requires native plugin)
        const floorData = { floorLevel: "Location Shared", rfFingerprint: "N/A (Web)" };

        // Update emergencyData with real locationUrl and floorData
        set({
          emergencyData: { ...get().emergencyData, locationUrl, floorData }
        });

        const newAlert = {
          type: reason,
          timestamp: Date.now(),
          riskLevel: 'CRITICAL',
          location: finalCoords,
          smsStatus: isCurrentlyOffline ? 'QUEUED_MESH' : 'PENDING',
          emailStatus: isCurrentlyOffline ? 'QUEUED_MESH' : 'PENDING',
          whatsappShared: false,
          audioLabel: audioLabel || null,
          audioConfidence: audioConfidence || null,
          mapsLink: locationUrl,
          snapshotMetadata,
          floorData,
          meshRelayed: isCurrentlyOffline
        };

        let alertId = null;
        if (uid) {
          try {
            // Write directly to Firestore
            const alertRef = await addDoc(collection(db, 'users', uid, 'alerts'), newAlert);
            alertId = alertRef.id;
          } catch (err) {
            console.warn("Failed to write emergency alert to Firestore:", err);
          }
        }

        // Write directly to global emergencies collection (allowed under updated rules)
        let globalEmergencyId = null;
        try {
          const globalEmergency = {
            userId: uid || 'anonymous',
            userName: get().currentUser?.name || get().currentUser?.email || 'Citizen',
            userPhone: get().currentUser?.phone || '—',
            reason: reason,
            location: finalCoords,
            mapsLink: locationUrl,
            smsStatus: isCurrentlyOffline ? 'QUEUED_MESH' : 'PENDING',
            emailStatus: isCurrentlyOffline ? 'QUEUED_MESH' : 'PENDING',
            status: 'active',
            timestamp: Date.now(),
            snapshotMetadata,
            floorData
          };
          const globalRef = await addDoc(collection(db, 'emergencies'), globalEmergency);
          globalEmergencyId = globalRef.id;
          set({ activeEmergencyId: globalEmergencyId });
          console.log("✅ Emergency logged globally with ID:", globalRef.id);
        } catch (err) {
          console.warn("Failed to log emergency globally:", err.message);
        }

        if (isCurrentlyOffline) {
           console.log("Adding alert to offline mesh queue...");
           set({ offlineAlertQueue: [...get().offlineAlertQueue, newAlert] });
           return; // Stop here, backend fetch will fail anyway
        }

        // Call backend to send Email / SMS
        const recipientContacts = targetContact ? [targetContact] : get().contacts;
        if (recipientContacts.length === 0) {
          console.warn('No contacts to dispatch to — skipping backend SMS/email.');
          set({ smsDeliveryStatus: { status: 'NO_CONTACTS' } });
          return;
        }

        set({ emailStatus: 'SENDING', lastError: null });

        try {
          // Get Firebase auth token for authenticated backend request
          const idToken = await auth.currentUser?.getIdToken();
          const res = await fetch(`${backendUrl}/emergency/dispatch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              emergencyId: globalEmergencyId,
              reason,
              location: finalCoords,
              mapsLink: locationUrl,
              contacts: recipientContacts,
              targetContactId: targetContact?.id || null,
              userName: get().currentUser?.name || 'Citizen',
              userPhone: get().currentUser?.phone || '',
              photo: photoBase64
            })
          });
          const data = await res.json();
          if (data.success) {
            const finalSmsStatus = data.smsStatus || 'SUCCESS';
            const finalEmailStatus = data.emailStatus || 'SUCCESS';
            set({ 
              smsDeliveryStatus: { status: finalSmsStatus },
              emailStatus: finalEmailStatus,
              lastError: null
            });
            // Update Firestore with final status
            if (uid && alertId) {
              const alertDocRef = doc(db, 'users', uid, 'alerts', alertId);
              await updateDoc(alertDocRef, {
                smsStatus: finalSmsStatus,
                emailStatus: finalEmailStatus
              });
            }
            if (globalEmergencyId) {
              const globalDocRef = doc(db, 'emergencies', globalEmergencyId);
              await updateDoc(globalDocRef, {
                smsStatus: finalSmsStatus,
                emailStatus: finalEmailStatus
              });
            }
          } else {
            set({ emailStatus: 'ERROR', lastError: data.error || 'Server dispatch error' });
          }
        } catch (e) {
          console.error("Backend dispatch failed", e);
          set({ emailStatus: 'ERROR', lastError: e.message || 'Network request failed' });
        }
      };

      if (forceLocation) {
        dispatch(forceLocation);
      } else if (navigator.geolocation) {
        try {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              dispatch({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (err) => {
              dispatch(get().lastKnownLocation);
            },
            { timeout: 3000, enableHighAccuracy: true }
          );
        } catch (err) {
          console.warn("Geolocation query failed synchronously:", err);
          dispatch(get().lastKnownLocation);
        }
      } else {
        dispatch(get().lastKnownLocation);
      }
    },

    updateEmergencyData: (data) => {
      set({
        emergencyData: get().emergencyData ? { ...get().emergencyData, ...data } : null
      });
    },

    cancelEmergency: () => {
      const { countdownTimer, activeEmergencyId } = get();
      if (countdownTimer) clearInterval(countdownTimer);

      if (activeEmergencyId) {
        updateDoc(doc(db, 'emergencies', activeEmergencyId), { status: 'resolved' })
          .catch(err => console.warn("Failed to mark emergency resolved in firestore:", err));
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const BackgroundProtection = registerPlugin('BackgroundProtection');
          BackgroundProtection.cancelWarning().catch(err => {
            console.warn("Failed to cancel native warning:", err);
          });
        } catch (e) {
          console.warn("Failed to call cancelWarning plugin method:", e);
        }
      }

      set({
        isEmergencyMode: false,
        emergencyData: null,
        countdown: null,
        countdownTimer: null,
        smsDeliveryStatus: null,
        threatLevel: 'LOW',
        riskScore: 0,
        aiMessage: 'Emergency cancelled. System returning to normal.',
        lastEmergencyCancelTime: Date.now(),
        activeEmergencyId: null
      });
      safeSpeak('Emergency cancelled. System returning to normal.');
    }
  };
});

if (typeof window !== 'undefined') {
  Network.addListener('networkStatusChange', status => {
    useStore.getState().setOfflineStatus(!status.connected);
  });
  Network.getStatus().then(status => {
    useStore.getState().setOfflineStatus(!status.connected);
  });
  window.useStore = useStore;
}
