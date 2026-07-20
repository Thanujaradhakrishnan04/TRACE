const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const fs = require('fs');
const http = require('http');

// Manually parse .env file
if (fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf8');
  envText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testEmail() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "roshinielumalai12@gmail.com", "123456");
    console.log("Logged in. Getting token...");
    
    const idToken = await userCredential.user.getIdToken();
    
    console.log("Got token. Sending dispatch request...");
    
    const postData = JSON.stringify({
      reason: "TEST ALERT",
      location: { lat: 12.9716, lng: 77.5946 },
      mapsLink: "https://maps.google.com/?q=12.9716,77.5946",
      userName: "Roshini",
      userPhone: "+91 98765 43210",
      contacts: [
        {
          name: "Test Contact",
          email: "roshinielumalai12@gmail.com", 
          phone: "+1234567890",
          relation: "Test"
        }
      ]
    });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/emergency/dispatch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${idToken}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        console.log(`Response Body: ${data}`);
        process.exit(res.statusCode === 200 ? 0 : 1);
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      process.exit(1);
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

testEmail();
