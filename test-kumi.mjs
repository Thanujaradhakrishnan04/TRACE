const query = `[out:json][timeout:25];(node["amenity"="police"](around:5000,13.0827,80.2707););out center body;`;

try {
  const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
    method: 'POST',
    headers: {
      'User-Agent': 'StreetPatrol/1.0 (contact@streetpatrol.org)',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'data=' + encodeURIComponent(query)
  });
  console.log('Kumi status:', res.status);
  if (res.ok) {
    const data = await res.json();
    console.log('Kumi elements:', data.elements?.length);
  } else {
    console.log('Kumi text:', await res.text());
  }
} catch (err) {
  console.error('Kumi error:', err.message);
}
