import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/useStore';
import { calculateDistance } from '../utils/geo';

export const useSafeWalkMonitor = () => {
  const { socket, triggerEmergency } = useStore();
  const [isActive, setIsActive] = useState(false);
  const [destination, setDestination] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  
  // Real analytics variables for UI
  const [distanceKm, setDistanceKm] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [safetyScore, setSafetyScore] = useState(100);
  const [routeStatus, setRouteStatus] = useState('Safe');
  const [warnings, setWarnings] = useState([]);
  const [batteryLevel, setBatteryLevel] = useState(100);

  // Check-In Timer states
  const [checkInTimeLeft, setCheckInTimeLeft] = useState(null);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [checkInCountdown, setCheckInCountdown] = useState(15);

  const startTracking = useCallback((dest, checkInMinutes = 5) => {
    setDestination(dest);
    setIsActive(true);
    setCheckInTimeLeft(checkInMinutes * 60);
    setShowCheckInPrompt(false);
    setCheckInCountdown(15);
  }, []);

  const stopTracking = useCallback(() => {
    setIsActive(false);
    setDestination(null);
    setRouteCoords([]);
    setDistanceKm(0);
    setEtaMinutes(0);
    setCheckInTimeLeft(null);
    setShowCheckInPrompt(false);
  }, []);

  const confirmSafety = useCallback((nextIntervalMinutes = 5) => {
    setShowCheckInPrompt(false);
    setCheckInCountdown(15);
    setCheckInTimeLeft(nextIntervalMinutes * 60);
  }, []);

  // Battery tracking
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(err => console.error("Battery API error:", err));
    }
  }, []);

  // Check-In countdown effect
  useEffect(() => {
    let timerId;
    if (isActive && checkInTimeLeft !== null && checkInTimeLeft > 0 && !showCheckInPrompt) {
      timerId = setInterval(() => {
        setCheckInTimeLeft(prev => {
          if (prev <= 1) {
            setShowCheckInPrompt(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [isActive, checkInTimeLeft, showCheckInPrompt]);

  // Safety confirmation countdown effect
  useEffect(() => {
    let confirmId;
    if (showCheckInPrompt) {
      confirmId = setInterval(() => {
        setCheckInCountdown(prev => {
          if (prev <= 1) {
            clearInterval(confirmId);
            triggerEmergency('SafeWalk Check-In Timeout');
            setShowCheckInPrompt(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(confirmId);
  }, [showCheckInPrompt, triggerEmergency]);

  useEffect(() => {
    let watchId;

    if (isActive) {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        // Get initial position immediately
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newLoc = { lat: latitude, lng: longitude };
            setCurrentLocation(newLoc);
            setRouteCoords([[latitude, longitude]]);
            if (destination) {
              const dist = calculateDistance(latitude, longitude, destination.lat, destination.lng) / 1000;
              setDistanceKm(dist);
              setEtaMinutes(Math.round(dist * 12)); // Approx 12 min per km walking speed
            }
          },
          (err) => console.error("Initial GPS Error:", err),
          { enableHighAccuracy: true }
        );

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const newLoc = { lat: latitude, lng: longitude };
            
            setCurrentLocation(newLoc);
            
            // Calculate real distance remaining
            if (destination) {
              const dist = calculateDistance(latitude, longitude, destination.lat, destination.lng) / 1000;
              setDistanceKm(dist);
              setEtaMinutes(Math.round(dist * 12));
            }
            
            setRouteCoords(prev => {
              const updated = [...prev, [latitude, longitude]];
              return updated;
            });

            if (socket) {
              socket.emit('gps_update', {
                lat: latitude,
                lng: longitude,
                accuracy,
                timestamp: Date.now()
              });
            }
          },
          (error) => {
            console.error("GPS Error:", error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
          }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
      }
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isActive, destination, socket]);

  return {
    currentLocation,
    routeCoords,
    isActive,
    startTracking,
    stopTracking,
    distanceKm,
    etaMinutes,
    safetyScore,
    routeStatus,
    warnings,
    batteryLevel,
    checkInTimeLeft,
    showCheckInPrompt,
    checkInCountdown,
    confirmSafety
  };
};
