const query = `[out:json][timeout:25];(node["amenity"="police"](around:5000,13.0827,80.2707););out center body;`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'data=' + encodeURIComponent(query)
})
.then(r => r.json())
.then(data => console.log('Response:', data.elements.length))
.catch(err => console.error(err));
