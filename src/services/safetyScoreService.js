// ─── Safety Score Service ──────────────────────────────────────────────────────
// Calculates a 0–100 safety score based on real geospatial data.
//
// Scoring spec (start from 100, apply bonuses/penalties):
//   Police   within 500m → +15, 1km → +10, 2km → +5
//   Hospital within 500m → +10, 1km → +7,  2km → +3
//   Pharmacy within 500m → +5
//   Commercial/Residential area → +10
//   Industrial area → -10
//   Isolated/empty area (no nearby amenities) → -20
//   Forest/empty land → -25
//   After 10 PM → -10
//
// Levels:  90-100 Very Safe, 70-89 Safe, 50-69 Moderate Risk, 0-49 High Risk

/**
 * @param {number} lat
 * @param {number} lng
 * @param {Array<{lat,lng,type,distance}>} nearbyZones — pre-fetched from overpassService
 * @param {string[]} landuse — e.g. ['commercial','residential','industrial','forest']
 * @param {number} [hour] — current hour (0-23), defaults to current time
 * @returns {{ score: number, level: string, reasons: string[] }}
 */
export const calculateLocationSafetyScore = (lat, lng, nearbyZones = [], landuse = [], hour = null) => {
  const currentHour = hour ?? new Date().getHours();
  let score = 100;
  const reasons = [];

  // ─── Positive: Police proximity ────────────────────────────────────────────
  const police = nearbyZones.filter(z => z.type === 'police');
  const closestPolice = police.length > 0 ? Math.min(...police.map(p => p.distance)) : Infinity;

  if (closestPolice <= 500) {
    score += 15;
    reasons.push(`✓ Police Station ${formatDist(closestPolice)} away`);
  } else if (closestPolice <= 1000) {
    score += 10;
    reasons.push(`✓ Police Station ${formatDist(closestPolice)} away`);
  } else if (closestPolice <= 2000) {
    score += 5;
    reasons.push(`✓ Police Station ${formatDist(closestPolice)} away`);
  } else {
    reasons.push('⚠ No police station within 2 km');
  }

  // ─── Positive: Hospital proximity ──────────────────────────────────────────
  const hospitals = nearbyZones.filter(z => z.type === 'hospital' || z.type === 'clinic');
  const closestHospital = hospitals.length > 0 ? Math.min(...hospitals.map(h => h.distance)) : Infinity;

  if (closestHospital <= 500) {
    score += 10;
    reasons.push(`✓ Hospital ${formatDist(closestHospital)} away`);
  } else if (closestHospital <= 1000) {
    score += 7;
    reasons.push(`✓ Hospital ${formatDist(closestHospital)} away`);
  } else if (closestHospital <= 2000) {
    score += 3;
    reasons.push(`✓ Hospital ${formatDist(closestHospital)} away`);
  } else {
    reasons.push('⚠ No hospital within 2 km');
  }

  // ─── Positive: Pharmacy proximity ──────────────────────────────────────────
  const pharmacies = nearbyZones.filter(z => z.type === 'pharmacy');
  const closestPharmacy = pharmacies.length > 0 ? Math.min(...pharmacies.map(p => p.distance)) : Infinity;

  if (closestPharmacy <= 500) {
    score += 5;
    reasons.push(`✓ Pharmacy ${formatDist(closestPharmacy)} away`);
  }

  // ─── Positive: Land use ────────────────────────────────────────────────────
  const hasCommercial = landuse.some(l => ['commercial', 'retail', 'residential'].includes(l));
  if (hasCommercial) {
    score += 10;
    reasons.push('✓ Active populated area');
  }

  // ─── Negative: Industrial area ─────────────────────────────────────────────
  if (landuse.includes('industrial')) {
    score -= 10;
    reasons.push('⚠ Industrial area');
  }

  // ─── Negative: Forest / empty land ─────────────────────────────────────────
  const hasWilderness = landuse.some(l => ['forest', 'farmland', 'meadow', 'scrub'].includes(l));
  if (hasWilderness) {
    score -= 25;
    reasons.push('⚠ Forest / empty land nearby');
  }

  // ─── Negative: Isolated (very few amenities within 2km) ────────────────────
  const totalNearby = nearbyZones.filter(z => z.distance <= 2000).length;
  if (totalNearby <= 1 && !hasCommercial) {
    score -= 20;
    reasons.push('⚠ Isolated area — few nearby facilities');
  }

  // ─── Negative: Night time ──────────────────────────────────────────────────
  if (currentHour >= 22 || currentHour < 6) {
    score -= 10;
    reasons.push('⚠ Night time — reduced visibility');
  }

  // ─── Clamp ─────────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ─── Level ─────────────────────────────────────────────────────────────────
  let level;
  if (score >= 90)      level = 'VERY_SAFE';
  else if (score >= 70) level = 'SAFE';
  else if (score >= 50) level = 'MODERATE';
  else                  level = 'HIGH_RISK';

  return { score, level, reasons };
};

/**
 * Format distance for display.
 */
const formatDist = (meters) => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};
