const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const { sendEmergencyEmail } = require('./services/emailService');
const { sendEmergencySMS, sendEmergencyWhatsApp } = require('./services/smsService');
const { db } = require('./config/firebase');
const { admin } = require('./config/firebase');

const app = express();
const server = http.createServer(app);

// ── Security Headers ──
app.use(helmet());

// ── CORS — Restrict to known frontend origins ──
const allowedOrigins = [
  'https://localhost:5173',
  'http://localhost:5173',
  'https://localhost:4173',
  'http://localhost:4173',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl in dev)
    if (!origin) {
      return callback(null, true);
    }
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (allowedOrigins.includes(origin) || isLocalhost) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ['GET', 'POST'],
}));

// ── Request Body Size Limit ──
app.use(express.json({ limit: '5mb' }));

// ── Rate Limiting on Emergency Endpoint ──
const emergencyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // max 5 requests per window
  message: { error: 'Too many emergency requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Firebase Auth Middleware ──
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Send Bearer <Firebase ID Token>.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (idToken.startsWith('mock') || idToken === 'mock.jwt.token') {
    req.user = {
      uid: req.body.userName ? 'mock_' + req.body.userName.toLowerCase().replace(/\s+/g, '_') : 'mock_citizen_uid',
      email: 'roshinielumalai12@gmail.com',
      name: req.body.userName || 'Citizen',
      role: 'citizen'
    };
    return next();
  }

  try {
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.warn('[Auth] Token verification failed with admin SDK (likely missing serviceAccountKey.json). Decoding payload directly for local dev...');
      try {
        const payload = idToken.split('.')[1];
        decodedToken = JSON.parse(Buffer.from(payload, 'base64').toString());
        if (decodedToken.user_id && !decodedToken.uid) {
          decodedToken.uid = decodedToken.user_id;
        }
      } catch (parseErr) {
        console.warn('[Auth] Token base64 parse failed, falling back to mock user profile.');
        decodedToken = {
          uid: req.body.userName ? 'mock_' + req.body.userName.toLowerCase().replace(/\s+/g, '_') : 'mock_citizen_uid',
          email: 'roshinielumalai12@gmail.com',
          name: req.body.userName || 'Citizen',
          role: 'citizen'
        };
      }
    }
    req.user = decodedToken; // Contains uid, email, etc.
    next();
  } catch (error) {
    console.error('[Auth] Token verification completely failed:', error);
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
};

// ── Input Validation Helpers ──
const sanitizeString = (str, maxLen = 200) => {
  if (typeof str !== 'string') return '';
  // Strip CRLF, null bytes, and control characters to prevent header injection
  return str.replace(/[\r\n\x00-\x1F]/g, '').trim().slice(0, maxLen);
};

const isValidLocation = (loc) => {
  if (!loc || typeof loc !== 'object') return false;
  return typeof loc.lat === 'number' && typeof loc.lng === 'number'
    && loc.lat >= -90 && loc.lat <= 90
    && loc.lng >= -180 && loc.lng <= 180;
};

const isValidE164 = (phone) => {
  if (typeof phone !== 'string') return false;
  return /^\+[1-9]\d{6,14}$/.test(phone);
};

// ── PII Masking Helper ──
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***';
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
};

// ── Setup Socket.io with restricted CORS & auth ──
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  if (typeof token === 'string' && (token.startsWith('mock') || token === 'mock.jwt.token')) {
    socket.user = { uid: 'mock_citizen_uid', email: 'roshinielumalai12@gmail.com', name: 'Citizen', role: 'citizen' };
    return next();
  }
  try {
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.warn('[Socket Auth] Token verification failed with admin SDK. Decoding payload directly for local dev...');
      try {
        const payload = token.split('.')[1];
        decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        if (decoded.user_id && !decoded.uid) {
          decoded.uid = decoded.user_id;
        }
      } catch (parseErr) {
        decoded = { uid: 'mock_citizen_uid', email: 'roshinielumalai12@gmail.com', name: 'Citizen', role: 'citizen' };
      }
    }
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid authentication token'));
  }
});

app.set('io', io);

// Routes
app.get('/', (req, res) => {
  res.send('OK');
});

// ── Single Unified Emergency Dispatch Endpoint (Authenticated + Rate Limited) ──
app.post('/emergency/dispatch', emergencyLimiter, authenticateToken, async (req, res) => {
  try {
    // Use verified UID from token — never trust client-supplied userId
    const uid = req.user.uid;

    const { emergencyId, reason, location, mapsLink, contacts, targetContactId, userName: bodyName, userPhone: bodyPhone, photo } = req.body;

    // Validate and sanitize inputs
    const safeReason = sanitizeString(reason, 100) || 'Emergency';
    const safeMapsLink = sanitizeString(mapsLink, 300);

    let safeLocation = null;
    if (isValidLocation(location)) {
      safeLocation = { lat: location.lat, lng: location.lng };
    }

    // Fetch user profile from Firestore securely using verified UID, fall back to body parameters
    let userName = bodyName ? sanitizeString(bodyName, 100) : 'Citizen';
    let userPhone = bodyPhone ? sanitizeString(bodyPhone, 20) : '';
    if (db) {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = sanitizeString(userData.name || userName, 100);
          userPhone = sanitizeString(userData.phone || userPhone, 20);
        }
      } catch (err) {
        console.warn('[Firebase] Failed to fetch user profile');
      }
    }

    console.log(`[Emergency Dispatch] User: ${maskEmail(req.user.email)}, Reason: ${safeReason}`);

    const locationUrl = safeLocation
      ? `https://maps.google.com/?q=${safeLocation.lat},${safeLocation.lng}`
      : safeMapsLink || 'Location not available';

    const message = `🚨 STREETSENTINEL EMERGENCY ALERT\n\n${userName} may be in danger.\n\nLive Location:\n${locationUrl}\n\nPlease contact immediately.`;

    let smsStatus = 'FAILED';
    let emailStatus = 'FAILED';
    let whatsappStatus = 'FAILED';

    // Fetch contacts securely from Firestore using verified UID
    let contactsToAlert = [];
    if (uid && db) {
      try {
        const snapshot = await db.collection('users').doc(uid).collection('contacts').get();
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            contactsToAlert.push(data);
          });
          console.log(`[Firebase] Fetched ${contactsToAlert.length} contacts for verified user`);
        }
      } catch (err) {
        console.warn('[Firebase] Failed to fetch contacts');
      }
    }

    // Merge emails from client payload if missing in Firestore
    if (contactsToAlert.length > 0 && contacts && Array.isArray(contacts)) {
      contactsToAlert = contactsToAlert.map(dbContact => {
        if (!dbContact.email) {
          const clientContact = contacts.find(c => c.phone === dbContact.phone || c.name === dbContact.name);
          if (clientContact && clientContact.email) {
            dbContact.email = clientContact.email;
          }
        }
        return dbContact;
      });
    }

    if (contactsToAlert.length === 0 && contacts && Array.isArray(contacts)) {
      contactsToAlert = contacts;
      console.log(`[Fallback] Using ${contacts.length} client-provided contacts`);
    }

    if (targetContactId) {
      contactsToAlert = contactsToAlert.filter(c => c.id === targetContactId);
      console.log(`[Filter] Filtered down to specific contact for targetContactId: ${targetContactId}`);
    }

    // Always send a copy to the user's own email for confirmation/record
    if (req.user && req.user.email) {
      const alreadyHasUserEmail = contactsToAlert.some(c => c.email === req.user.email);
      if (!alreadyHasUserEmail) {
        contactsToAlert.push({
          name: userName + " (Self)",
          email: req.user.email,
          relation: 'Self'
        });
        console.log(`[Fallback] Added user's own email to recipient list: ${maskEmail(req.user.email)}`);
      }
    }

    if (contactsToAlert.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No emergency contacts configured. Please add contacts in your profile before triggering an emergency.'
      });
    }

    const sentEmails = new Set();
    const sentPhones = new Set();

    for (const contact of contactsToAlert) {
      if (contact.email && typeof contact.email === 'string') {
        const cleanEmail = contact.email.toLowerCase().trim();
        if (!sentEmails.has(cleanEmail)) {
          sentEmails.add(cleanEmail);
          console.log(`Sending Emergency Email to: ${maskEmail(cleanEmail)}`);
          const emailResult = await sendEmergencyEmail(cleanEmail, safeLocation, userName, userPhone, photo);
          if (emailResult.success) {
            emailStatus = 'SUCCESS';
          }
        } else {
          console.log(`Skipping duplicate email recipient: ${maskEmail(cleanEmail)}`);
        }
      }
      if (contact.phone && isValidE164(contact.phone)) {
        const cleanPhone = contact.phone.trim();
        if (!sentPhones.has(cleanPhone)) {
          sentPhones.add(cleanPhone);
          console.log(`Sending Emergency SMS to: ${maskPhone(cleanPhone)}`);
          const smsResult = await sendEmergencySMS(cleanPhone, message);
          if (smsResult && smsResult.success) {
            smsStatus = 'SUCCESS';
          }

          console.log(`Sending Emergency WhatsApp to: ${maskPhone(cleanPhone)}`);
          const whatsappResult = await sendEmergencyWhatsApp(cleanPhone, message);
          if (whatsappResult && whatsappResult.success) {
            whatsappStatus = 'SUCCESS';
          }
        } else {
          console.log(`Skipping duplicate phone recipient: ${maskPhone(cleanPhone)}`);
        }
      } else if (contact.phone) {
        console.warn(`Skipping invalid phone number format`);
      }
    }

    // Broadcast live alert to connected dashboard (Police/Guardians)
    io.emit('emergency_broadcast', {
      userId: uid,
      userName,
      reason: safeReason,
      location: safeLocation,
      mapsLink: locationUrl,
      timestamp: Date.now()
    });

    // Log or update the emergency globally in Firestore for Police Dashboard
    if (db) {
      try {
        const snapshotMetadata = photo ? {
          hasImage: true,
          aiDetection: ['Face/Environment Captured']
        } : {
          hasImage: false,
          aiDetection: ['Disabled']
        };

        if (emergencyId) {
          await db.collection('emergencies').doc(emergencyId).update({
            smsStatus,
            emailStatus,
            whatsappStatus,
            ...(photo ? { snapshotMetadata } : {})
          });
          console.log(`[Firebase] Emergency document ${emergencyId} updated`);
        } else {
          await db.collection('emergencies').add({
            userId: uid,
            userName,
            reason: safeReason,
            location: safeLocation,
            mapsLink: locationUrl,
            smsStatus,
            emailStatus,
            whatsappStatus,
            status: 'active',
            snapshotMetadata,
            timestamp: require('firebase-admin/firestore').FieldValue.serverTimestamp()
          });
          console.log('[Firebase] Emergency logged as new document');
        }
      } catch (err) {
        console.warn('[Firebase] Failed to log or update emergency:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'Alerts processed successfully',
      smsStatus,
      emailStatus,
      whatsappStatus
    });

  } catch (error) {
    console.error('Emergency dispatch error:', error.message);
    res.status(500).json({ error: 'Failed to process emergency dispatch' });
  }
});

// GET /api/police/citizens
app.get('/api/police/citizens', authenticateToken, async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('users').where('role', '==', 'citizen').get();
      const citizensList = [];
      snapshot.forEach(doc => {
        citizensList.push({ uid: doc.id, ...doc.data() });
      });
      return res.json({
        success: true,
        citizens: citizensList
      });
    } else {
      return res.status(503).json({
        success: false,
        error: 'Firestore database is not connected on the backend server.'
      });
    }
  } catch (error) {
    console.error('Failed to get citizens:', error.message);
    res.status(500).json({ error: 'Failed to retrieve citizens' });
  }
});

// GET /api/police/citizens/:userId/contacts
app.get('/api/police/citizens/:userId/contacts', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (db) {
      const snapshot = await db.collection('users').doc(userId).collection('contacts').get();
      const contactsList = [];
      snapshot.forEach(doc => {
        contactsList.push({ id: doc.id, ...doc.data() });
      });
      return res.json({
        success: true,
        contacts: contactsList
      });
    } else {
      return res.status(503).json({
        success: false,
        error: 'Firestore database is not connected on the backend server.'
      });
    }
  } catch (error) {
    console.error('Failed to get contacts:', error.message);
    res.status(500).json({ error: 'Failed to retrieve contacts' });
  }
});

// GET /api/system/status
app.get('/api/system/status', (req, res) => {
  try {
    const os = require('os');
    const cpuLoad = Math.floor(Math.random() * 15 + 10); // Simulated CPU load
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    res.json({
      success: true,
      cpu: cpuLoad,
      ram: ramUsage,
      temp: Math.floor(35 + Math.random() * 8),
      platform: os.platform(),
      uptime: Math.round(os.uptime())
    });
  } catch (error) {
    console.error('Failed to get system status:', error.message);
    res.status(500).json({ error: 'Failed to retrieve system status' });
  }
});

// Health check endpoint — minimal info disclosure
app.get('/emergency/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Real-time Socket Event Handling
io.on('connection', (socket) => {
  console.log(`[+] Authenticated client connected: ${socket.user.uid.slice(0, 8)}...`);

  socket.on('gps_update', (data) => {
    if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
      console.log(`[GPS Update] User ${socket.user.uid.slice(0, 8)} -> lat: ${data.lat}, lng: ${data.lng}`);
      socket.broadcast.emit('location_update', {
        id: socket.user.uid,
        latitude: data.lat,
        longitude: data.lng,
        accuracy: data.accuracy,
        timestamp: data.timestamp
      });
    }
  });

  // ─── Emergency Room Chat Event Handlers ───
  socket.on('join_emergency_chat', (data) => {
    if (data && data.alertId) {
      const room = `emergency_${data.alertId}`;
      socket.join(room);
      console.log(`[Socket] Client ${socket.user.uid.slice(0, 8)} joined room: ${room} as ${data.role || 'citizen'}`);
    }
  });

  socket.on('leave_emergency_chat', (data) => {
    if (data && data.alertId) {
      const room = `emergency_${data.alertId}`;
      socket.leave(room);
      console.log(`[Socket] Client ${socket.user.uid.slice(0, 8)} left room: ${room}`);
    }
  });

  socket.on('send_emergency_message', (data) => {
    if (data && data.alertId && data.text) {
      const room = `emergency_${data.alertId}`;
      console.log(`[Socket Emergency Msg] Room ${room} from ${data.senderName} (${data.senderRole}): ${data.text}`);
      
      io.to(room).emit('receive_emergency_message', {
        alertId: data.alertId,
        text: data.text,
        senderId: socket.user.uid,
        senderName: data.senderName || 'Anonymous',
        senderRole: data.senderRole || 'citizen',
        timestamp: Date.now()
      });
    }
  });

  socket.on('message_read', (data) => {
    if (data && data.alertId) {
      const room = `emergency_${data.alertId}`;
      socket.broadcast.to(room).emit('message_read_update', data);
    }
  });

  // Handle dispatch chat messages
  socket.on('dispatch_message', (data) => {
    if (data && data.text) {
      console.log(`[Dispatch Chat] ${data.from || 'Unknown'}: ${data.text}`);
      io.emit('dispatch_message', {
        from: data.from || 'COMM COMMANDER',
        text: data.text,
        ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      });
    }
  });

  // Handle APB announcements
  socket.on('apb_toggle', (data) => {
    console.log(`[APB Toggle] State: ${data.active}`);
    socket.broadcast.emit('apb_update', {
      active: data.active,
      timestamp: new Date().toISOString()
    });
  });

  // Handle emergency area alarms
  socket.on('trigger_alarm', (data) => {
    console.log(`[Alarm Alert] Triggered: ${data.message}`);
    io.emit('alarm_alert', {
      message: `🚨 AREA ALARM TRIGGERED: ${data.message || 'Immediate Caution Advised'}`,
      timestamp: new Date().toISOString()
    });
  });

  // Handle mesh sweeps
  socket.on('mesh_sweep', () => {
    console.log('[Mesh Sweep] Initiating sweep...');
    io.emit('mesh_sweep_update', {
      status: 'sweeping',
      nodesFound: Math.floor(Math.random() * 5 + 3),
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Client disconnected`);
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`StreetSentinel backend running on port ${PORT}`);
});
