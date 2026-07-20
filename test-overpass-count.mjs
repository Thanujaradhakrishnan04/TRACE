// Using native fetch

async function test() {
  const query = `[out:json][timeout:25];(
    node["amenity"="police"](around:5000,12.9716,77.5946);
    way["amenity"="police"](around:5000,12.9716,77.5946);
    node["amenity"="hospital"](around:5000,12.9716,77.5946);
    way["amenity"="hospital"](around:5000,12.9716,77.5946);
    node["amenity"="pharmacy"](around:5000,12.9716,77.5946);
    node["shop"="chemist"](around:5000,12.9716,77.5946);
  );out tags;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });

  const data = await response.json();
  
  let police = 0;
  let hospital = 0;
  let pharmacy = 0;

  data.elements.forEach(el => {
    const t = el.tags || {};
    if (t.amenity === 'police') police++;
    if (t.amenity === 'hospital') hospital++;
    if (t.amenity === 'pharmacy' || t.shop === 'chemist') pharmacy++;
  });

  console.log({ police, hospital, pharmacy });
}

test().catch(console.error);
