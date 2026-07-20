import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScanFace, Camera } from 'lucide-react';

const FaceScanner = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stream = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCamera(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Camera access denied or unavailable.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setScanning(true);
    
    // Simulate a 1.5s scanning effect
    setTimeout(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Scale down canvas for Firestore limit
      const maxW = 320;
      const scale = Math.min(1, maxW / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get base64 image highly compressed
      const imageUrl = canvas.toDataURL('image/jpeg', 0.5);
      setScanning(false);
      onCapture(imageUrl);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-200 bg-slate-900 shadow-[0_0_30px_rgba(225,29,72,0.2)]">
        
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <Camera size={32} className="mb-2 opacity-50" />
            <span className="text-xs">{error}</span>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
        )}

        {/* Scanner Overlay UI */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-8 border-primary-red/30 rounded-full"></div>
          
          {scanning && (
            <motion.div 
              className="absolute top-0 left-0 w-full h-full bg-primary-red/20 border-t-2 border-primary-red"
              animate={{ y: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
          )}

          {/* Crosshairs */}
          <div className="absolute top-4 bottom-4 left-1/2 w-0.5 bg-white/20 transform -translate-x-1/2"></div>
          <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-white/20 transform -translate-y-1/2"></div>
        </div>
      </div>

      <button 
        onClick={handleCapture}
        disabled={!hasCamera || scanning}
        className={`mt-8 flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all ${
          !hasCamera || scanning 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
            : 'bg-primary-red text-white hover:bg-red-700 shadow-red-500/30'
        }`}
      >
        <ScanFace size={24} className={scanning ? 'animate-pulse' : ''} />
        {scanning ? 'SCANNING BIOMETRICS...' : 'CAPTURE FACE & REGISTER'}
      </button>

      {error && (
        <button 
          type="button"
          onClick={() => onCapture('https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256')}
          className="mt-4 flex items-center gap-2 px-6 py-2 rounded-xl font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all text-xs"
        >
          Bypass and Use Mock Biometrics
        </button>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default FaceScanner;
