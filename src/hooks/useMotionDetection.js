import { useEffect, useRef } from 'react';

export const useMotionDetection = (isActive, onShakeDetected) => {
  const shakeCountRef = useRef(0);
  const lastShakeTimeRef = useRef(0);
  const SHAKE_THRESHOLD = 800; // sensitivity

  useEffect(() => {
    if (!isActive) return;

    let lastX = null, lastY = null, lastZ = null;
    let lastUpdate = 0;

    const handleMotion = (e) => {
      const current = e.accelerationIncludingGravity;
      if (!current) return;

      const currentTime = Date.now();
      if ((currentTime - lastUpdate) > 100) {
        const diffTime = (currentTime - lastUpdate);
        lastUpdate = currentTime;

        if (lastX !== null && lastY !== null && lastZ !== null) {
          const speed = Math.abs(current.x + current.y + current.z - lastX - lastY - lastZ) / diffTime * 10000;

          if (speed > SHAKE_THRESHOLD) {
            if (currentTime - lastShakeTimeRef.current > 2000) {
              // Reset if last shake was more than 2 seconds ago
              shakeCountRef.current = 0;
            }
            shakeCountRef.current += 1;
            lastShakeTimeRef.current = currentTime;

            if (shakeCountRef.current >= 3) {
              shakeCountRef.current = 0; // reset
              if (onShakeDetected) onShakeDetected();
            }
          }
        }
        
        lastX = current.x;
        lastY = current.y;
        lastZ = current.z;
      }
    };

    if (window.DeviceMotionEvent) {
      if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
        window.DeviceMotionEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', handleMotion, false);
            }
          })
          .catch(err => console.error("DeviceMotion permission denied or errored:", err));
      } else {
        window.addEventListener('devicemotion', handleMotion, false);
      }
    }

    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion, false);
      }
    };
  }, [isActive, onShakeDetected]);
};
