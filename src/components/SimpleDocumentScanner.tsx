'use client';

import { useRef, useEffect, useState } from 'react';

declare global {
  interface Window {
    cv: any;
  }
}

export default function SimpleDocumentScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cvLoaded, setCvLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.onload = () => {
      if (window.cv) {
        window.cv.onRuntimeInitialized = () => {
          setCvLoaded(true);
          console.log('OpenCV loaded');
        };
      }
    };
    document.head.appendChild(script);
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
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const detectDocument = () => {
    if (!cvLoaded || !window.cv || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;

    // Set canvas size
    canvas.width = video.offsetWidth;
    canvas.height = video.offsetHeight;

    try {
      // Create small processing canvas
      const processCanvas = document.createElement('canvas');
      const processCtx = processCanvas.getContext('2d');
      processCanvas.width = 320;
      processCanvas.height = (video.videoHeight / video.videoWidth) * 320;
      
      processCtx?.drawImage(video, 0, 0, processCanvas.width, processCanvas.height);

      // OpenCV processing
      const src = window.cv.imread(processCanvas);
      const gray = new window.cv.Mat();
      const blur = new window.cv.Mat();
      const thresh = new window.cv.Mat();
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();

      // Simple processing
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
      window.cv.GaussianBlur(gray, blur, new window.cv.Size(5, 5), 0);
      window.cv.threshold(blur, thresh, 0, 255, window.cv.THRESH_BINARY + window.cv.THRESH_OTSU);
      
      // Find contours
      window.cv.findContours(thresh, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      // Find largest contour
      let maxArea = 0;
      let bestContour = null;
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        if (area > maxArea && area > 1000) {
          maxArea = area;
          bestContour = contour;
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bestContour) {
        // Approximate to polygon
        const epsilon = 0.02 * window.cv.arcLength(bestContour, true);
        const approx = new window.cv.Mat();
        window.cv.approxPolyDP(bestContour, approx, epsilon, true);

        if (approx.rows === 4) {
          // Scale back to display size
          const scaleX = canvas.width / processCanvas.width;
          const scaleY = canvas.height / processCanvas.height;

          // Draw outline
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.beginPath();

          for (let i = 0; i < 4; i++) {
            const x = approx.data32S[i * 2] * scaleX;
            const y = approx.data32S[i * 2 + 1] * scaleY;
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          
          ctx.closePath();
          ctx.stroke();

          // Draw corners
          ctx.fillStyle = '#ff0000';
          for (let i = 0; i < 4; i++) {
            const x = approx.data32S[i * 2] * scaleX;
            const y = approx.data32S[i * 2 + 1] * scaleY;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
        approx.delete();
      }

      // Cleanup
      src.delete();
      gray.delete();
      blur.delete();
      thresh.delete();
      contours.delete();
      hierarchy.delete();

    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  useEffect(() => {
    let animationId: number;
    
    if (isScanning && cvLoaded) {
      const loop = () => {
        detectDocument();
        animationId = requestAnimationFrame(loop);
      };
      animationId = requestAnimationFrame(loop);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isScanning, cvLoaded]);

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
            disabled={!cvLoaded}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
          >
            {cvLoaded ? 'Start Scanner' : 'Loading OpenCV...'}
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

      <div className="text-sm text-gray-600">
        {cvLoaded ? '✓ OpenCV Ready' : '⏳ Loading OpenCV...'}
      </div>
    </div>
  );
}