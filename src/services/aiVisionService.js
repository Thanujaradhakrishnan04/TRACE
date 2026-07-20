import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

class AIVisionService {
  constructor() {
    this.model = null;
    this.isLoaded = false;
  }

  async loadModel() {
    if (this.isLoaded) return;
    try {
      console.log('[AI Vision] Loading Coco-SSD model for offline detection...');
      // Ensure WebGL backend is ready for performance, fallback to CPU
      await tf.ready();
      this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      this.isLoaded = true;
      console.log('[AI Vision] Model loaded successfully.');
    } catch (error) {
      console.error('[AI Vision] Failed to load AI model:', error);
    }
  }

  /**
   * Analyzes an HTML image element to detect surrounding context.
   * @param {HTMLImageElement} imageElement 
   * @returns {Promise<string>} Summary of detected objects
   */
  async analyzeSnapshot(imageElement) {
    if (!this.isLoaded || !this.model) {
      await this.loadModel();
    }
    
    if (!this.model) return "AI analysis unavailable";

    try {
      const predictions = await this.model.detect(imageElement);
      
      if (predictions.length === 0) {
        return "No distinct objects detected in vicinity";
      }

      // Aggregate predictions
      const contextCounts = {};
      predictions.forEach(p => {
        // Only trust predictions with > 50% confidence
        if (p.score > 0.5) {
          contextCounts[p.class] = (contextCounts[p.class] || 0) + 1;
        }
      });

      const summaryParts = Object.entries(contextCounts).map(([objClass, count]) => {
        return `${count} ${objClass}${count > 1 ? 's' : ''}`;
      });

      return summaryParts.length > 0 
        ? `Detected: ${summaryParts.join(', ')}`
        : "No high-confidence objects detected";

    } catch (error) {
      console.error('[AI Vision] Analysis failed:', error);
      return "AI snapshot analysis failed";
    }
  }
}

export const aiVisionService = new AIVisionService();
