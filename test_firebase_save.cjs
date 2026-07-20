require('./server/node_modules/dotenv').config(); // reads from root .env
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } = require('firebase/auth');
const { getFirestore, doc, setDoc, addDoc, collection, getDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});

const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    const testEmail = 'autotest_' + Date.now() + '@example.com';
    const testPass = 'TestPass123!';
    
    console.log('Creating test user:', testEmail);
    const cred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
    const uid = cred.user.uid;
    console.log('User created in Auth with UID:', uid);
    
    console.log('Attempting to write profile data to Firestore...');
    await setDoc(doc(db, 'users', uid), { 
      name: 'Auto Test User', 
      email: testEmail, 
      biometricPhoto: 'data:image/jpeg;base64,mockdata' 
    });
    console.log('✅ Profile data saved successfully to Firestore!');
    
    console.log('Attempting to write emergency contact...');
    const contactRef = await addDoc(collection(db, 'users', uid, 'contacts'), { 
      name: 'Test Guardian', 
      phone: '1234567890' 
    });
    console.log('✅ Emergency contact saved successfully! (Contact ID: ' + contactRef.id + ')');
    
    console.log('Attempting to read back data...');
    const snap = await getDoc(doc(db, 'users', uid));
    if(snap.exists()) {
      console.log('✅ Data verified in database! Name:', snap.data().name);
    } else {
      throw new Error('Document not found after write!');
    }
    
    console.log('\n🎉 ALL TESTS PASSED! Your Firebase Database is correctly saving data!');
    
    // cleanup
    await deleteUser(cred.user);
    process.exit(0);
  } catch(e) {
    console.error('\n❌ TEST FAILED:', e.message);
    if(e.code === 'permission-denied') {
      console.log('🚨 This is a Permission Denied error! You still need to update the rules in Firebase Console!');
    }
    process.exit(1);
  }
}

test();
