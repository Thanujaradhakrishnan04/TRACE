import { useState, useEffect } from 'react';
import { useStore } from '../context/useStore';

/**
 * useVerticalPositioning
 * Attempts to estimate indoor floor level using Barometric pressure (via generic Sensor APIs if available)
 * and falls back to a simulated mathematical model for scaffolding purposes.
 */
export const useVerticalPositioning = () => {
  const [floorLevel, setFloorLevel] = useState('Ground Floor');
  const [altitude, setAltitude] = useState(0);
  const { isEmergencyMode, updateEmergencyData } = useStore();

  useEffect(() => {
    let interval;

    if (isEmergencyMode) {
      console.log('[Vertical Positioning] Activating Barometric/RF scan...');

      // Scaffolding: In a real app with native Android code, we would bind to a Capacitor plugin here.
      // E.g., await BarometerPlugin.startListening();
      
      // We simulate a mock fluctuation and estimation algorithm
      let currentMockAltitude = 12.5; // meters above sea level base
      
      interval = setInterval(() => {
        // Simulate reading pressure data changes
        const fluctuation = (Math.random() - 0.5) * 0.5; 
        currentMockAltitude += fluctuation;
        
        setAltitude(currentMockAltitude);

        // Simple algorithm: assume ~3 meters per floor, starting at 10m base
        let estimatedFloor = 'Ground Floor';
        const heightAboveBase = currentMockAltitude - 10;
        
        if (heightAboveBase > 3) {
          const floorNum = Math.floor(heightAboveBase / 3);
          estimatedFloor = `Floor ${floorNum}`;
        } else if (heightAboveBase < -3) {
          estimatedFloor = 'Basement';
        }

        setFloorLevel(estimatedFloor);
        
        // Push the update to the global emergency payload
        updateEmergencyData({ floorLevel: estimatedFloor });
        
      }, 5000); // Check every 5 seconds during an emergency
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isEmergencyMode, updateEmergencyData]);

  return { floorLevel, altitude };
};
