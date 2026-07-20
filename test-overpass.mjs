// Using native fetch

// Dummy implementation of calculateDistance
function calculateDistance(lat1, lon1, lat2, lon2) {
  return 1000;
}

const fetchNearbyAmenities = async (lat, lng, radius = 5000, types = ['police', 'hospital', 'pharmacy']) => {
  const amenityFilters = types
    .filter(t => t !== 'womens_shelter')
    .map(t => {
      let filter = `node["amenity"="${t}"](around:${radius},${lat},${lng});\nway["amenity"="${t}"](around:${radius},${lat},${lng});`;
      if (t === 'pharmacy') {
        filter += `\nnode["healthcare"="pharmacy"](around:${radius},${lat},${lng});`;
        filter += `\nnode["shop"="chemist"](around:${radius},${lat},${lng});`;
        filter += `\nway["shop"="chemist"](around:${radius},${lat},${lng});`;
        filter += `\nnode["shop"="medical_supply"](around:${radius},${lat},${lng});`;
      }
      if (t === 'clinic') {
        filter += `\nnode["healthcare"="clinic"](around:${radius},${lat},${lng});`;
        filter += `\nway["healthcare"="clinic"](around:${radius},${lat},${lng});`;
      }
      return filter;
    })
    .join('\n');
  const shelterFilter = types.includes('womens_shelter')
    ? `node["social_facility"="womens_shelter"](around:${radius},${lat},${lng});`
    : '';

  const query = `[out:json][timeout:25];(${amenityFilters}\n${shelterFilter});out center body;`;

  console.log("Query:", query);

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'StreetSentinel-Test/1.0'
        },
        body: 'data=' + encodeURIComponent(query)
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Found:", data.elements.length);
        return data;
      } else {
        console.warn(`Endpoint ${endpoint} returned status ${response.status}`);
      }
    } catch (err) {
      console.warn(`Endpoint ${endpoint} failed:`, err.message);
    }
  }
};

fetchNearbyAmenities(12.9716, 77.5946, 5000, ['police', 'hospital', 'pharmacy', 'clinic']).then(console.log).catch(console.error);
