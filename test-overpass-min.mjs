const lat = 13.0827;
const lng = 80.2707;
const radius = 5000;
const query = `[out:json][timeout:25];
(
  node["amenity"="police"](around:${radius},${lat},${lng});
);
out center body;`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: query
})
.then(r => r.text())
.then(text => console.log('Response:', text.substring(0, 150)))
.catch(err => console.error(err));
