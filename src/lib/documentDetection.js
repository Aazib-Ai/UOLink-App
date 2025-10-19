/**
 * Robust document detection using OpenCV.js
 * Handles busy backgrounds and noisy environments
 */

export class DocumentDetector {
  constructor() {
    this.isOpenCVReady = false;
    this.initOpenCV();
  }

  async initOpenCV() {
    if (typeof cv === 'undefined') {
      throw new Error('OpenCV.js not loaded');
    }
    this.isOpenCVReady = true;
  }

  /**
   * Main document detection function
   * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} imageElement 
   * @returns {Array} Four corner points of detected document or null
   */
  detectDocument(imageElement) {
    if (!this.isOpenCVReady) return null;

    let src = cv.imread(imageElement);
    let result = null;

    try {
      // Step 1: Preprocessing to isolate document
      const preprocessed = this.preprocessImage(src);
      
      // Step 2: Find contours with optimized parameters
      const contours = this.findContours(preprocessed);
      
      // Step 3: Find document contour with robust filtering
      result = this.findDocumentContour(contours, src.rows, src.cols);
      
    } catch (error) {
      console.error('Document detection error:', error);
    } finally {
      src.delete();
    }

    return result;
  }

  /**
   * Advanced preprocessing to isolate document from busy background
   */
  preprocessImage(src) {
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const thresh = new cv.Mat();
    const morphed = new cv.Mat();

    try {
      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Gaussian blur to reduce noise (tuned kernel size)
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // Adaptive threshold to separate document from background
      // This is crucial for busy backgrounds like tablecloths
      cv.adaptiveThreshold(
        blurred, thresh,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11, // Block size - adjust based on image resolution
        10  // C constant - fine-tune for your lighting conditions
      );

      // Morphological operations to clean up the image
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      return morphed;
    } finally {
      gray.delete();
      blurred.delete();
      thresh.delete();
    }
  }

  /**
   * Find contours with optimized Canny edge detection
   */
  findContours(preprocessed) {
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // Canny edge detection with tuned thresholds
      cv.Canny(preprocessed, edges, 75, 200, 3, false);

      // Find contours
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      return contours;
    } finally {
      edges.delete();
      hierarchy.delete();
    }
  }

  /**
   * Robust document contour detection with multiple validation checks
   */
  findDocumentContour(contours, imageHeight, imageWidth) {
    const minArea = (imageHeight * imageWidth) * 0.1; // Minimum 10% of image area
    const maxArea = (imageHeight * imageWidth) * 0.9; // Maximum 90% of image area
    
    // Sort contours by area (largest first)
    const sortedContours = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > minArea && area < maxArea) {
        sortedContours.push({ contour, area });
      }
    }
    
    sortedContours.sort((a, b) => b.area - a.area);

    // Find the first contour that looks like a document
    for (const { contour } of sortedContours) {
      const corners = this.findCorners(contour);
      if (corners && this.validateDocumentShape(corners, imageWidth, imageHeight)) {
        contour.delete();
        return corners;
      }
      contour.delete();
    }

    return null;
  }

  /**
   * Find four corners of a contour using Douglas-Peucker approximation
   */
  findCorners(contour) {
    const epsilon = 0.02 * cv.arcLength(contour, true);
    const approx = new cv.Mat();
    
    try {
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      if (approx.rows === 4) {
        // Extract the four corner points
        const corners = [];
        for (let i = 0; i < 4; i++) {
          corners.push({
            x: approx.data32S[i * 2],
            y: approx.data32S[i * 2 + 1]
          });
        }
        return this.orderCorners(corners);
      }
    } finally {
      approx.delete();
    }
    
    return null;
  }

  /**
   * Validate that the detected shape looks like a document
   */
  validateDocumentShape(corners, imageWidth, imageHeight) {
    // Check if corners form a reasonable quadrilateral
    const area = this.calculatePolygonArea(corners);
    const minArea = (imageWidth * imageHeight) * 0.1;
    const maxArea = (imageWidth * imageHeight) * 0.9;
    
    if (area < minArea || area > maxArea) return false;

    // Check aspect ratio (documents are usually rectangular)
    const width1 = this.distance(corners[0], corners[1]);
    const width2 = this.distance(corners[2], corners[3]);
    const height1 = this.distance(corners[1], corners[2]);
    const height2 = this.distance(corners[3], corners[0]);
    
    const avgWidth = (width1 + width2) / 2;
    const avgHeight = (height1 + height2) / 2;
    const aspectRatio = Math.max(avgWidth, avgHeight) / Math.min(avgWidth, avgHeight);
    
    // Reasonable aspect ratio for documents (not too square, not too elongated)
    return aspectRatio > 1.2 && aspectRatio < 3.0;
  }

  /**
   * Order corners: top-left, top-right, bottom-right, bottom-left
   */
  orderCorners(corners) {
    // Sort by y-coordinate
    corners.sort((a, b) => a.y - b.y);
    
    // Top two points
    const top = corners.slice(0, 2).sort((a, b) => a.x - b.x);
    // Bottom two points  
    const bottom = corners.slice(2, 4).sort((a, b) => a.x - b.x);
    
    return [
      top[0],    // top-left
      top[1],    // top-right
      bottom[1], // bottom-right
      bottom[0]  // bottom-left
    ];
  }

  /**
   * Calculate distance between two points
   */
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Calculate area of polygon using shoelace formula
   */
  calculatePolygonArea(corners) {
    let area = 0;
    const n = corners.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += corners[i].x * corners[j].y;
      area -= corners[j].x * corners[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Lightweight live detection optimized for real-time performance
   */
  detectDocumentLive(videoElement, callback) {
    if (!this.isOpenCVReady) return;

    let isProcessing = false;
    let animationId;
    
    const processFrame = () => {
      if (isProcessing) {
        animationId = requestAnimationFrame(processFrame);
        return;
      }
      
      isProcessing = true;
      
      try {
        const corners = this.detectDocumentLite(videoElement);
        callback(corners);
      } catch (error) {
        console.error('Live detection error:', error);
      } finally {
        isProcessing = false;
        // Process every 3rd frame (~10 FPS at 30 FPS input)
        setTimeout(() => {
          animationId = requestAnimationFrame(processFrame);
        }, 100);
      }
    };

    animationId = requestAnimationFrame(processFrame);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }

  /**
   * Ultra-fast document detection for live preview
   * Downscales image and uses minimal processing
   */
  detectDocumentLite(videoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Downscale to 480px width for performance
    const scale = 480 / videoElement.videoWidth;
    canvas.width = 480;
    canvas.height = videoElement.videoHeight * scale;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    let src = cv.imread(canvas);
    let result = null;

    try {
      const preprocessed = this.preprocessImageLite(src);
      const contours = this.findContoursLite(preprocessed);
      result = this.findDocumentContourLite(contours, src.rows, src.cols, scale);
    } catch (error) {
      console.error('Lite detection error:', error);
    } finally {
      src.delete();
    }

    return result;
  }

  /**
   * Minimal preprocessing for live detection
   */
  preprocessImageLite(src) {
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const thresh = new cv.Mat();

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.blur(gray, blurred, new cv.Size(3, 3)); // Faster than Gaussian
      cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      return thresh;
    } finally {
      gray.delete();
      blurred.delete();
    }
  }

  /**
   * Fast contour detection
   */
  findContoursLite(preprocessed) {
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.Canny(preprocessed, edges, 50, 150, 3, false); // Lower thresholds for speed
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      return contours;
    } finally {
      edges.delete();
      hierarchy.delete();
    }
  }

  /**
   * Fast document contour detection
   */
  findDocumentContourLite(contours, imageHeight, imageWidth, scale) {
    const minArea = (imageHeight * imageWidth) * 0.1;
    
    // Only check top 5 largest contours for speed
    const candidates = [];
    for (let i = 0; i < Math.min(contours.size(), 5); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > minArea) {
        candidates.push({ contour, area });
      }
    }
    
    candidates.sort((a, b) => b.area - a.area);

    for (const { contour } of candidates) {
      const corners = this.findCornersLite(contour);
      if (corners) {
        // Scale corners back to original video size
        const scaledCorners = corners.map(corner => ({
          x: corner.x / scale,
          y: corner.y / scale
        }));
        contour.delete();
        return scaledCorners;
      }
      contour.delete();
    }

    return null;
  }

  /**
   * Fast corner detection
   */
  findCornersLite(contour) {
    const epsilon = 0.05 * cv.arcLength(contour, true); // Less precise for speed
    const approx = new cv.Mat();
    
    try {
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      if (approx.rows === 4) {
        const corners = [];
        for (let i = 0; i < 4; i++) {
          corners.push({
            x: approx.data32S[i * 2],
            y: approx.data32S[i * 2 + 1]
          });
        }
        return this.orderCorners(corners);
      }
    } finally {
      approx.delete();
    }
    
    return null;
  }
}