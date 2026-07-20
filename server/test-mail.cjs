require('dotenv').config({ path: __dirname + '/.env' });
const { sendEmergencyEmail } = require('./services/emailService');

async function test() {
  console.log("Testing email dispatch...");
  const result = await sendEmergencyEmail(
    'roshinielumalai12@gmail.com', 
    { lat: 12.9716, lng: 77.5946 }, 
    'Test User', 
    '+919884293869'
  );
  console.log("Result:", result);
}

test();
