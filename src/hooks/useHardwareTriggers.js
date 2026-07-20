import { useState, useEffect } from 'react';
import { useStore } from '../context/useStore';
import { useAudioDetection } from './useAudioDetection';
import { useLocationTracking } from './useLocationTracking';
import { useMotionDetection } from './useMotionDetection';
import { useRiskEngine } from './useRiskEngine';

export const useHardwareTriggers = () => {
  const {
    triggerEmergency,
    setAudioLevel,
    setGpsActive,
    setLastGpsUpdateTime,
    setThreatLevel,
    isListening,
    setIsListening,
  } = useStore();
  const { riskScore, calculateRisk } = useRiskEngine();

  // ─── Audio Pipeline ───────────────────────────────────────────────────────────
  // Only VOICE_SOS (distress keyword from speech recognition) triggers emergency.
  // Noise spikes alone only raise the risk score — they DO NOT trigger emergency.
  const handleAudioThreat = (threatInfo) => {
    console.log('Audio Threat Detected:', threatInfo);
    if (threatInfo.type === 'VOICE_SOS' || threatInfo.type === 'LOUD_SOUND_SOS') {
      triggerEmergency('Audio Threat Detected', threatInfo.label, threatInfo.confidence);
    }
  };

  const {
    decibels,
    detectedSound,
    audioConfidence,
    isCalibrating,
    calibrationProgress,
    baselineDb,
    currentThreshold,
    micPermission,
    audioContextState,
    analyserNode,
  } = useAudioDetection(isListening, handleAudioThreat);

  // Sync Audio dB to Store
  useEffect(() => {
    if (isListening && !isCalibrating) {
      setAudioLevel(decibels);
    } else if (!isListening) {
      setAudioLevel(-100);
    }
  }, [decibels, isListening, isCalibrating, setAudioLevel]);

  // Motion Pipeline — shake detection still triggers emergency
  useMotionDetection(isListening, () => {
    console.log('Shake SOS Triggered!');
    triggerEmergency('Shake SOS Detected');
  });

  // Location Pipeline
  const { gpsActive, batteryLevel } = useLocationTracking(isListening, (locationData) => {
    setGpsActive(true);
    const timeStr = new Date(locationData.timestamp).toLocaleTimeString('en-US', { hour12: false });
    setLastGpsUpdateTime(timeStr);
    useStore.setState({ lastKnownLocation: { lat: locationData.lat, lng: locationData.lng } });
  });

  // ─── Risk Evaluation Pipeline ─────────────────────────────────────────────────
  // High risk scores update the threat level display but do NOT auto-trigger emergency.
  useEffect(() => {
    if (isListening && !isCalibrating) {
      let dbSeverity = 0;
      if (decibels > baselineDb + 20) {
        dbSeverity = Math.min((decibels - baselineDb - 20) / 40, 1);
      }

      const { level, score } = calculateRisk({
        audioConfidence,
        dbSeverity,
        movementAnomaly: 0,
      });

      // Update threat level display only — do NOT call triggerEmergency from here
      if (level === 'EMERGENCY' || level === 'HIGH_RISK') {
        setThreatLevel(
          level === 'EMERGENCY' ? 'HIGH' : 'MEDIUM',
          level === 'EMERGENCY'
            ? 'High ambient noise detected. Stay alert.'
            : 'Elevated noise level. Monitoring closely.'
        );
      } else if (level === 'SAFE') {
        // Only reset to LOW if not already in emergency mode
        const currentLevel = useStore.getState().threatLevel;
        if (currentLevel !== 'CRITICAL') {
          setThreatLevel('LOW', 'Sentinel AI active. Environment stable.');
        }
      }

      // Keep riskScore in the store (for SafetyScore card)
      useStore.setState({ riskScore: score });
    }
  }, [isListening, decibels, audioConfidence, calculateRisk, baselineDb, isCalibrating, setThreatLevel]);

  return {
    isListening,
    setIsListening,
    detectedSound,
    audioConfidence,
    isCalibrating,
    calibrationProgress,
    baselineDb,
    currentThreshold,
    batteryLevel,
    micPermission,
    audioContextState,
    analyserNode,
  };
};
