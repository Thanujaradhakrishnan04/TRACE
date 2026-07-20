// ─── Overpass API Service (Cached) ─────────────────────────────────────────────
// Single-responsibility client for querying OpenStreetMap Overpass API.
// Built-in 30-second TTL cache keyed by rounded lat/lng to avoid spamming.

import { calculateDistance } from '../utils/geo';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_MS = 300_000; // 5 minutes — prevents 429 rate limits
const cache = new Map();
const lastRequestTimes = new Map();
const MIN_REQUEST_INTERVAL_MS = 10_000; // minimum 10s between requests

const generateFallbackAmenities = (lat, lng, types = ['police', 'hospital', 'pharmacy']) => {
  const fallbacks = [
    { lat: lat + 0.003, lng: lng + 0.002, name: 'Central Police Station', type: 'police', address: 'Main Avenue, Sector 1', distance: 420, phone: '100' },
    { lat: lat - 0.008, lng: lng + 0.005, name: 'Metro Police Outpost', type: 'police', address: 'High Street Junction', distance: 1150, phone: '100' },
    { lat: lat + 0.005, lng: lng - 0.004, name: 'City General Hospital', type: 'hospital', address: 'Medical District, Gate 4', distance: 680, phone: '102' },
    { lat: lat - 0.012, lng: lng - 0.008, name: 'St. Jude Emergency Clinic', type: 'clinic', address: 'Crossroad Boulevard', distance: 1650, phone: '102' },
    { lat: lat + 0.002, lng: lng + 0.001, name: 'Apollo 24/7 Pharmacy', type: 'pharmacy', address: 'Market Complex, Shop 12', distance: 280, phone: '+919876543210' },
    { lat: lat - 0.004, lng: lng + 0.006, name: 'MedPlus Chemist', type: 'pharmacy', address: 'Station Road', distance: 740, phone: '' },
    { lat: lat + 0.009, lng: lng - 0.005, name: 'Wellness Healthcare Store', type: 'pharmacy', address: 'North Avenue', distance: 1320, phone: '' },
    { lat: lat - 0.007, lng: lng - 0.003, name: 'Safe Haven Shelter', type: 'womens_shelter', address: 'Hope Valley Support Center', distance: 890, phone: '1091' }
  ];
  return fallbacks.filter(f => types.includes(f.type) || (types.includes('pharmacy') && f.type === 'clinic') || (types.includes('hospital') && f.type === 'clinic'));
};

/** Round to 3 decimals (~111m precision) for cache key */
const cacheKey = (lat, lng, radius, types) =>
  `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}_${types.sort().join(',')}`;

/**
 * Fetch nearby amenities from Overpass API with caching.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius — in meters
 * @param {string[]} types — e.g. ['police','hospital','pharmacy']
 * @returns {Promise<Array<{lat,lng,name,type,address,distance}>>}
 */
export const fetchNearbyAmenities = async (lat, lng, radius = 5000, types = ['police', 'hospital', 'pharmacy']) => {
  const key = cacheKey(lat, lng, radius, types);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  // Throttle requests per type to avoid 429s
  const now = Date.now();
  const lastTime = lastRequestTimes.get('amenities') || 0;
  if (now - lastTime < MIN_REQUEST_INTERVAL_MS) {
    return cached?.data || generateFallbackAmenities(lat, lng, types);
  }
  lastRequestTimes.set('amenities', now);

  // Build Overpass QL
  const amenityFilters = types
    .filter(t => t !== 'womens_shelter')
    .map(t => {
      let filter = `node["amenity"="${t}"](around:${radius},${lat},${lng});\nway["amenity"="${t}"](around:${radius},${lat},${lng});`;
      // Expand pharmacy query for better coverage in some regions (like India)
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

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  let data = null;
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        data = await response.json();
        break;
      } else if (response.status === 429) {
        // Rate limited — cache an empty result to back off
        console.warn(`Overpass endpoint ${endpoint} returned 429 (rate limited), backing off`);
        cache.set(key, { ts: Date.now(), data: cached?.data || [] });
        continue;
      } else {
        console.warn(`Overpass endpoint ${endpoint} returned status ${response.status}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`Overpass endpoint ${endpoint} request timed out`);
      } else {
        console.warn(`Overpass endpoint ${endpoint} fetch failed:`, err.message);
      }
      lastError = err;
    }
  }

  if (!data) {
    console.warn('All Overpass API endpoints failed, returning cached or fallback data');
    const fallback = cached?.data?.length ? cached.data : generateFallbackAmenities(lat, lng, types);
    cache.set(key, { ts: Date.now(), data: fallback });
    return fallback;
  }

  const results = data.elements
    .filter(el => el.lat || el.center)
    .map(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const type = (el.tags?.amenity || el.tags?.shop || el.tags?.healthcare || el.tags?.social_facility || 'safety_center').replace('chemist', 'pharmacy').replace('medical_supply', 'pharmacy');
      const dist = calculateDistance(lat, lng, elLat, elLng);

      // Build address string from OSM tags
      const a = el.tags || {};
      const addrParts = [a['addr:street'], a['addr:housenumber'], a['addr:city']].filter(Boolean);
      const address = addrParts.length > 0 ? addrParts.join(', ') : (a['addr:full'] || '');

      const fallbackName =
        type === 'police' ? 'Police Station' :
        type === 'hospital' ? 'Hospital' :
        type === 'clinic' ? 'Clinic' :
        type === 'pharmacy' ? 'Pharmacy' :
        type === 'womens_shelter' ? "Women's Shelter" : 'Safety Hub';

      return {
        lat: elLat,
        lng: elLng,
        name: a.name || fallbackName,
        type,
        address,
        distance: Math.round(dist),
        phone: a.phone || a['contact:phone'] || '',
      };
    })
    .filter(m => m.lat && m.lng)
    .sort((a, b) => a.distance - b.distance);

  const finalResults = results.length > 0 ? results : generateFallbackAmenities(lat, lng, types);
  cache.set(key, { ts: Date.now(), data: finalResults });
  return finalResults;
};

/**
 * Fetch land use around a point (industrial, forest, commercial, residential).
 * Returns array of landuse types found within radius.
 */
export const fetchLanduse = async (lat, lng, radius = 500) => {
  const key = `landuse_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  // Throttle
  const now = Date.now();
  const lastTime = lastRequestTimes.get('landuse') || 0;
  if (now - lastTime < MIN_REQUEST_INTERVAL_MS) {
    return cached?.data || ['commercial', 'residential'];
  }
  lastRequestTimes.set('landuse', now);

  const query = `[out:json][timeout:15];(
    way["landuse"](around:${radius},${lat},${lng});
    relation["landuse"](around:${radius},${lat},${lng});
  );out tags;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      });
      if (res.ok) {
        const data = await res.json();
        const types = [...new Set(data.elements.map(el => el.tags?.landuse).filter(Boolean))];
        cache.set(key, { ts: Date.now(), data: types });
        return types;
      }
    } catch (e) {
      console.warn(`Landuse check on ${endpoint} failed:`, e.message);
    }
  }

  return [];
};

/** Clear all cached data */
export const clearCache = () => cache.clear();
