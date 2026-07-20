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

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'StreetSentinel-Test/1.0'
    },
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
    if (t.amenity === 'pharmacy' || t.shop === 'chemist' || t.healthcare === 'pharmacy') pharmacy++;
  });

  console.log({ police, hospital, pharmacy });
};

fetchNearbyAmenities(13.0270, 80.0050, 15000, ['police', 'hospital', 'clinic', 'pharmacy', 'womens_shelter']);
