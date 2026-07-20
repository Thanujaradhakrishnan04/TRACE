const http = require('http');
const body = JSON.stringify({
  emergencyId: "test_ip_123",
  reason: "Test IP",
  location: { lat: 12.0, lng: 77.0 },
  contacts: [{ id: "1", name: "Self", phone: "999", email: "roshinielumalai12@gmail.com" }]
});
const req = http.request({
  hostname: '192.168.0.105',
  port: 4000,
  path: '/emergency/dispatch',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mock.jwt.token' }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log("Status:", res.statusCode, "Data:", data));
});
req.on('error', e => console.error("Error:", e.message));
req.write(body);
req.end();
