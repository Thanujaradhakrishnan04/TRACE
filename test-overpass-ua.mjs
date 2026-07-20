const query = `[out:json][timeout:25];(node["amenity"="police"](around:5000,13.0827,80.2707););out center body;`;

try {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    body: query
  });
  console.log('POST status:', res.status);
  if (res.ok) {
    const data = await res.json();
    console.log('POST elements:', data.elements?.length);
  }
} catch (err) {
  console.error('POST error:', err.message);
}
