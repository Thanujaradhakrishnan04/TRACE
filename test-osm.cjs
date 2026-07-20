const query = `[out:json];(node(around:5000, 13.026, 80.015)["amenity"~"police|pharmacy"];way(around:5000, 13.026, 80.015)["amenity"~"police|pharmacy"];node(around:5000, 13.026, 80.015)["shop"~"chemist|medical_supply"];);out center tags;`;
fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query })
  .then(res => res.text())
  .then(text => console.log(text.substring(0, 500)))
  .catch(err => console.error(err));
