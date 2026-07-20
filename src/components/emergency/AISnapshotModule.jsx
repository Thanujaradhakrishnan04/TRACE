import React, { useEffect } from 'react';
import { useStore } from '../../context/useStore';

/**
 * Headless component. Photo capture during SOS activation has been removed completely.
 */
const AISnapshotModule = () => {
  const { isEmergencyMode, updateEmergencyData } = useStore();

  useEffect(() => {
    if (isEmergencyMode) {
      console.log('[AI Snapshot] Photo capture feature disabled during SOS activation.');
      updateEmergencyData({ surroundingContext: "Photo capture disabled" });
    }
  }, [isEmergencyMode, updateEmergencyData]);

  return null;
};

export default AISnapshotModule;
