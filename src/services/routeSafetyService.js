// ─── Route Safety Service ──────────────────────────────────────────────────────
// Analyzes how many safety facilities are along a walking route.

import { calculateDistance } from '../utils/geo';

const PROXIMITY_THRESHOLD = 300; // meters — a zone "along the route" if within 300m of any point

/**
 * Analyze safety of a route by counting nearby facilities.
 * @param {Array<[number,number]>} routeCoords — [[lat,lng], ...]
 * @param {Array<{lat,lng,type,name,distance}>} nearbyZones
 * @returns {{ policeCount, hospitalCount, pharmacyCount, estimatedScore, reasons[] }}
 */
export const analyzeRouteSafety = (routeCoords, nearbyZones) => {
  if (!routeCoords?.length || !nearbyZones?.length) {
    return { policeCount: 0, hospitalCount: 0, pharmacyCount: 0, estimatedScore: 60, reasons: ['⚠ No data available'] };
  }

  // Sample every 5th route point for performance (routes can have hundreds of points)
  const sampledCoords = routeCoords.filter((_, i) => i % 5 === 0);

  const policeAlong    = new Set();
  const hospitalAlong  = new Set();
  const pharmacyAlong  = new Set();

  for (const zone of nearbyZones) {
    for (const [lat, lng] of sampledCoords) {
      const d = calculateDistance(lat, lng, zone.lat, zone.lng);
      if (d < PROXIMITY_THRESHOLD) {
        if (zone.type === 'police')                          policeAlong.add(zone.name);
        else if (zone.type === 'hospital' || zone.type === 'clinic') hospitalAlong.add(zone.name);
        else if (zone.type === 'pharmacy')                   pharmacyAlong.add(zone.name);
        break; // no need to check more route points for this zone
      }
    }
  }

  const policeCount   = policeAlong.size;
  const hospitalCount = hospitalAlong.size;
  const pharmacyCount = pharmacyAlong.size;

  // Score: base 50, +10 per police, +7 per hospital, +3 per pharmacy, cap 100
  let estimatedScore = 50 + policeCount * 10 + hospitalCount * 7 + pharmacyCount * 3;
  estimatedScore = Math.min(100, Math.max(0, estimatedScore));

  const reasons = [];
  if (policeCount > 0)   reasons.push(`✓ ${policeCount} police station${policeCount > 1 ? 's' : ''} along route`);
  else                    reasons.push('⚠ No police stations along this route');
  if (hospitalCount > 0) reasons.push(`✓ ${hospitalCount} hospital${hospitalCount > 1 ? 's' : ''} nearby`);
  if (pharmacyCount > 0) reasons.push(`✓ ${pharmacyCount} pharmac${pharmacyCount > 1 ? 'ies' : 'y'} nearby`);

  return { policeCount, hospitalCount, pharmacyCount, estimatedScore, reasons };
};
