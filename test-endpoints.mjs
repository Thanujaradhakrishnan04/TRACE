const query = `[out:json][timeout:25];(node["amenity"="police"](around:5000,13.0827,80.2707););out center body;`;

const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

for (const endpoint of endpoints) {
  try {
    const res = await fetch(endpoint + '?data=' + encodeURIComponent(query));
    console.log(endpoint, 'status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log(endpoint, 'elements:', data.elements?.length);
    } else {
      const text = await res.text();
      console.log(endpoint, 'text:', text.substring(0, 100));
    }
  } catch (err) {
    console.error(endpoint, 'error:', err.message);
  }
}
