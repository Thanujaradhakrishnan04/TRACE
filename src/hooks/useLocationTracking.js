import { useEffect, useState, useRef } from 'react';
import { useVerticalPositioning } from './useVerticalPositioning';

export const useLocationTracking = (isActive, onLocationUpdate) => {
  const [gpsActive, setGpsActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const watchIdRef = useRef(null);
  const { floorLevel, altitude } = useVerticalPositioning();

  // Monitor Battery
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(err => console.error("Battery API error:", err));
    }
  }, []);

  // Monitor GPS
  useEffect(() => {
    if (!isActive) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      return;
    }

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setGpsActive(true);
          if (onLocationUpdate) {
            onLocationUpdate({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: altitude,
              floorLevel: floorLevel,
              batteryLevel: batteryLevel,
              timestamp: Date.now()
            });
          }
        },
        (error) => {
          console.error("GPS Error:", error);
          setGpsActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      setGpsActive(false);
    }

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isActive, onLocationUpdate, batteryLevel]);

  return { gpsActive, batteryLevel };
};
