import { useState, useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const BackgroundProtection = registerPlugin('BackgroundProtection');

// ─── dB Threshold Constants ───────────────────────────────────────────────────
// Web Audio API RMS-derived dB scale runs from -100 (silence) to 0 (max).
// Normal talking: roughly -35 to -20 dB.
// Loud shouting / screaming: roughly -10 to -5 dB.
//
// DAY thresholds
const DAY_ABSOLUTE_THRESHOLD = -15;   // Reduced from -5
const DAY_SPIKE_THRESHOLD    = 25;    // Reduced from 40
// NIGHT thresholds (slightly more sensitive)
const NIGHT_ABSOLUTE_THRESHOLD = -20; // Reduced from -8
const NIGHT_SPIKE_THRESHOLD    = 15;  // Reduced from 30

export const useAudioDetection = (isMonitoring, onThreatDetected) => {
  const [decibels, setDecibels] = useState(-100);
  const [detectedSound, setDetectedSound] = useState('NONE');
  const [audioConfidence, setAudioConfidence] = useState(0);
  const [audioContextState, setAudioContextState] = useState('UNINITIALIZED');
  const [micPermission, setMicPermission] = useState('PENDING');
  const [analyserNode, setAnalyserNode] = useState(null);

  // Calibration
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [baselineDb, setBaselineDb] = useState(-50);

  // Expose the day/night threshold so the UI can display it
  const [currentThreshold, setCurrentThreshold] = useState(DAY_ABSOLUTE_THRESHOLD);

  const audioContextRef    = useRef(null);
  const analyserRef        = useRef(null);
  const microphoneRef      = useRef(null);
  const animationFrameRef  = useRef(null);
  const recognitionRef     = useRef(null);
  const calibrateIntervalRef = useRef(null);
  const isMonitoringRef    = useRef(isMonitoring);

  const nativeAudioListenerRef = useRef(null);
  const nativeThreatListenerRef = useRef(null);

  useEffect(() => { isMonitoringRef.current = isMonitoring; }, [isMonitoring]);

  // ─── Web Speech API — only distress keywords trigger onThreatDetected ────────
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript.toLowerCase())
        .join('');

      console.log('Speech recognized:', transcript);

      const distressKeywords = ['help me', 'emergency', 'save me', 'call police', 'bachao', 'help'];
      const isDistress = distressKeywords.some(kw => transcript.includes(kw));

      if (isDistress && isMonitoringRef.current) {
        setDetectedSound('VOICE_SOS');
        setAudioConfidence(1.0);
        // Only voice keyword detection triggers the emergency callback
        if (onThreatDetected) {
          onThreatDetected({ type: 'VOICE_SOS', confidence: 1.0, label: 'Distress voice keyword detected' });
        }
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      if (isMonitoringRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (err) {}
      }
    };

    recognitionRef.current = recognition;

    return () => { try { recognition.stop(); } catch (e) {} };
  }, [onThreatDetected]);

  // ─── Start / Stop monitoring ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isMonitoring) { stopMonitoring(); return; }
    startMonitoring();
    return () => stopMonitoring();
  }, [isMonitoring]);

  const startMonitoring = async () => {
    if (Capacitor.isNativePlatform()) {
      setMicPermission('GRANTED');
      setAudioContextState('running');
      
      // Clean up previous listeners if any
      if (nativeAudioListenerRef.current) nativeAudioListenerRef.current.remove();
      if (nativeThreatListenerRef.current) nativeThreatListenerRef.current.remove();

      // Listen to decibels from native Foreground Service
      nativeAudioListenerRef.current = await BackgroundProtection.addListener('audioUpdate', (data) => {
        setDecibels(data.decibels);
        if (window.useStore) {
          window.useStore.setState({ rawAmplitude: data.peak || 0 });
        }
      });

      // Listen to native threats/events (e.g. VOICE_SOS or VOICE_DISARM)
      nativeThreatListenerRef.current = await BackgroundProtection.addListener('threatDetected', (data) => {
        console.log("Native threat/event received:", data);
        if (data.type === 'VOICE_DISARM') {
          // Trigger disarm/cancel in store
          if (window.useStore) {
            window.useStore.getState().cancelEmergency();
          }
        } else if (data.type === 'VOICE_SOS' || data.type === 'LOUD_SOUND_SOS') {
          if (onThreatDetected) {
            onThreatDetected({ type: data.type, confidence: data.confidence || 1.0, label: data.label });
          }
        } else if (data.type === 'EMAIL_STATUS') {
          if (window.useStore) {
            const parts = data.label.split('|');
            const status = parts[0] || 'ERROR';
            const errorMsg = parts[1] || '';
            window.useStore.setState({ 
              emailStatus: status,
              lastError: errorMsg || null
            });
          }
        }
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      setMicPermission('GRANTED');

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      setAudioContextState(audioContextRef.current.state);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      setAnalyserNode(analyserRef.current);

      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyserRef.current);

      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      }

      startCalibration();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setMicPermission('DENIED');
    }
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    const dbSamples = [];
    let progress = 0;

    calibrateIntervalRef.current = setInterval(() => {
      progress += 25;
      setCalibrationProgress(progress);

      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        let db = 20 * Math.log10(rms / 128);
        if (!isFinite(db)) db = -100;
        dbSamples.push(db);
      }

      if (progress >= 100) {
        clearInterval(calibrateIntervalRef.current);
        setIsCalibrating(false);
        const avgDb = dbSamples.reduce((a, b) => a + b, 0) / dbSamples.length;
        setBaselineDb(avgDb > -100 ? Math.round(avgDb) : -50);
        if (isMonitoringRef.current) detectLoudness();
      }
    }, 500);
  };

  const detectLoudness = () => {
    if (!analyserRef.current || !isMonitoringRef.current) return;

    animationFrameRef.current = setInterval(() => {
      if (!analyserRef.current || !isMonitoringRef.current) {
        clearInterval(animationFrameRef.current);
        return;
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] - 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      let db = 20 * Math.log10(rms / 128);
      if (!isFinite(db)) db = -100;
      db = Math.max(-100, Math.min(0, db));
      setDecibels(Math.round(db));
      if (window.useStore) {
        window.useStore.setState({ rawAmplitude: Math.round(rms) });
      }

      // ─── Use tighter thresholds so normal speech does NOT trigger ──────────
      const hour = new Date().getHours();
      const isNight = hour >= 20 || hour < 6;
      const absThreshold   = isNight ? NIGHT_ABSOLUTE_THRESHOLD   : DAY_ABSOLUTE_THRESHOLD;
      const spikeThreshold = isNight ? NIGHT_SPIKE_THRESHOLD      : DAY_SPIKE_THRESHOLD;

      // Expose current threshold so the UI can render a threshold line
      setCurrentThreshold(absThreshold);
      if (window.useStore) {
        window.useStore.setState({ currentThreshold: absThreshold });
      }

      // Noise spikes now directly trigger SOS based on user request.
      const isLoudSpike =
        db > (baselineDb + spikeThreshold) || db > absThreshold;

      if (isLoudSpike) {
        // Mark as a loud sound event — risk engine will pick this up via audioConfidence
        setDetectedSound('LOUD_SOUND');
        setAudioConfidence(Math.min((db - absThreshold) / 10 + 0.5, 0.9));
        
        // Trigger SOS on loud sound
        if (onThreatDetected) {
          onThreatDetected({ type: 'LOUD_SOUND_SOS', confidence: 0.8, label: 'Loud Noise Spike Detected' });
        }
      } else {
        setDetectedSound('NONE');
        setAudioConfidence(0);
      }
    }, 150);
  };

  const stopMonitoring = () => {
    if (Capacitor.isNativePlatform()) {
      if (nativeAudioListenerRef.current) {
        nativeAudioListenerRef.current.remove();
        nativeAudioListenerRef.current = null;
      }
      if (nativeThreatListenerRef.current) {
        nativeThreatListenerRef.current.remove();
        nativeThreatListenerRef.current = null;
      }
      setDecibels(-100);
      setDetectedSound('NONE');
      setAudioConfidence(0);
      return;
    }

    if (animationFrameRef.current)   clearInterval(animationFrameRef.current);
    if (calibrateIntervalRef.current) clearInterval(calibrateIntervalRef.current);
    setIsCalibrating(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    if (microphoneRef.current)  microphoneRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setDecibels(-100);
    setDetectedSound('NONE');
    setAudioConfidence(0);
    setAnalyserNode(null);
  };

  return {
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
  };
};
