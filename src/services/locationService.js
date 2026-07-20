// ─── Location Service ──────────────────────────────────────────────────────────
// Promise-based GPS utility with distance-based change detection.

import { calculateDistance } from '../utils/geo';

/** Minimum movement in meters to trigger a location change callback */
const MIN_MOVEMENT_METERS = 50;

/**
 * Get current position as a Promise.
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });

/**
 * Watch position and fire callback only when user moves > MIN_MOVEMENT_METERS.
 * @param {function} onMove — called with { lat, lng, accuracy }
 * @returns {function} stop — call to clear the watcher
 */
export const watchPositionWithThreshold = (onMove) => {
  let lastLat = null;
  let lastLng = null;

  const id = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (lastLat !== null) {
        const moved = calculateDistance(lastLat, lastLng, latitude, longitude);
        if (moved < MIN_MOVEMENT_METERS) return; // skip small movements
      }
      lastLat = latitude;
      lastLng = longitude;
      onMove({ lat: latitude, lng: longitude, accuracy });
    },
    err => console.warn('GPS watch error:', err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );

  return () => navigator.geolocation.clearWatch(id);
};
