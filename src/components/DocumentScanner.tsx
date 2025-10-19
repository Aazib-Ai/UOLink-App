'use client';

import { useRef, useEffect, useState } from 'react';
import { DocumentDetector } from '@/lib/documentDetection';

interface Corner {
  x: number;
  y: number;
}

export default function DocumentScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detector, setDetector] = useState<DocumentDetector | null>(null);
  const [corners, setCorners] = useState<Corner[] | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Initialize OpenCV and detector
    const initDetector = async () => {
      try {
        const det = new DocumentDetector();
        setDetector(det);
      } catch (error) {
        console.error('Failed to initialize detector:', error);
      }
    };

    // Load OpenCV.js if not already loaded
    if (typeof window !== 'undefined' && !window.cv) {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
      script.onload = initDetector;
      document.head.appendChild(script);
    } else {
      initDetector();
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setCorners(null);
  };

  useEffect(() => {
    let stopDetection: (() => void) | undefined;

    if (isScanning && detector && videoRef.current) {
      const stopFn = detector.detectDocumentLive(videoRef.current, (detectedCorners: Corner[] | null) => {
        setCorners(detectedCorners);
        drawOverlay(detectedCorners);
      });
      stopDetection = stopFn ?? undefined;
    }

    return () => {
      if (stopDetection) stopDetection();
    };
  }, [isScanning, detector]);

  const drawOverlay = (detectedCorners: Corner[] | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || video.videoWidth === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video display size
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detectedCorners && detectedCorners.length === 4) {
      // Scale corners to canvas size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      
      const scaledCorners = detectedCorners.map(corner => ({
        x: corner.x * scaleX,
        y: corner.y * scaleY
      }));

      // Draw document outline
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      scaledCorners.forEach((corner, index) => {
        if (index === 0) {
          ctx.moveTo(corner.x, corner.y);
        } else {
          ctx.lineTo(corner.x, corner.y);
        }
      });
      
      ctx.closePath();
      ctx.stroke();

      // Draw corner points
      ctx.fillStyle = '#ff0000';
      scaledCorners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 6, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="max-w-full h-auto border rounded-lg"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
        />
      </div>

      <div className="flex space-x-4">
        {!isScanning ? (
          <button
            onClick={startCamera}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Stop Scanner
          </button>
        )}
      </div>

      {corners && (
        <div className="text-sm text-green-600 font-medium">
          ✓ Document detected!
        </div>
      )}
    </div>
  );
}
