const http = require('http');

const body = JSON.stringify({
  emergencyId: "test_mobile_123",
  reason: "Test Mobile Distress",
  location: { lat: 12.9716, lng: 77.5946 },
  mapsLink: "https://maps.google.com/?q=12.9716,77.5946",
  contacts: [
    {
      id: "test_contact_1",
      name: "Roshini",
      phone: "+919876543210",
      relation: "Self",
      email: "roshinielumalai12@gmail.com"
    }
  ],
  targetContactId: null,
  userName: "Mobile User",
  userPhone: "+919999999999",
  photo: null
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/emergency/dispatch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock.jwt.token'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", data);
  });
});

req.on('error', e => console.error(e));
req.write(body);
req.end();
