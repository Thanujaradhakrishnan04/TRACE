async function testEmail() {
  try {
    const res = await fetch('http://localhost:4000/emergency/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Test from script',
        location: { lat: 12.9716, lng: 77.5946 },
        mapsLink: 'https://maps.google.com',
        contacts: [{ email: 'roshinielumalai12@gmail.com', name: 'Test Contact' }],
        userName: 'Test User',
        userPhone: '1234567890'
      })
    });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

testEmail();
