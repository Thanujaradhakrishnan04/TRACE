const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

let db;
let adminApp;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('[Firebase Admin] Initialized with serviceAccountKey.json');
    db = getFirestore(adminApp);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = initializeApp();
    console.log('[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS');
    db = getFirestore(adminApp);
  } else {
    adminApp = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'sos-street' });
    console.log('[Firebase Admin] Initialized with Application Default Credentials (DB will be mocked)');
    db = null;
  }
} catch (error) {
  console.error('[Firebase Admin] Initialization Error:', error.message);
  console.warn('⚠️ Ensure you have placed serviceAccountKey.json in the server/ directory to use Firestore features.');
  db = null;
}

module.exports = { admin: require('firebase-admin'), db };
