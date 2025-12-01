import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { requestCameraPermission } from './utils/permissions.js';
import { initializePoseDetector } from './utils/poseDetection.js';
import { referencePoints } from './config/referencePoints.js';
import { Canvas } from './components/Canvas.js';
import { UI } from './components/UI.js';

class YogaAssistant {
  constructor() {
    this.video = document.getElementById('webcam');
    this.canvas = new Canvas(document.getElementById('overlay'));
    this.ui = new UI();
    this.isRunning = false;
  }

  async init() {
    try {
      await tf.ready();
      await tf.setBackend('webgl');
      
      const stream = await requestCameraPermission();
      this.video.srcObject = stream;

      await new Promise(resolve => {
        this.video.onloadedmetadata = resolve;
      });

      const detector = await initializePoseDetector();
      
      this.ui.hideError();
      this.isRunning = true;
      this.startDetection(detector);
    } catch (error) {
      this.ui.showError(error.message);
      console.error('Error initializing:', error);
    }
  }

  async startDetection(detector) {
    const detectPose = async () => {
      if (!this.isRunning) return;

      try {
        const poses = await detector.estimatePoses(this.video);
        
        this.canvas.clear();
        
        if (poses.length > 0) {
          const pose = poses[0];
          this.drawPose(pose);
          this.drawReferencePoints();
          this.calculateAccuracy(pose);
        }

        requestAnimationFrame(detectPose);
      } catch (error) {
        this.ui.showError('Error detecting pose. Please refresh the page.');
        this.isRunning = false;
      }
    };

    detectPose();
  }

  drawPose(pose) {
    pose.keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        this.canvas.drawKeypoint(keypoint.x, keypoint.y);
      }
    });
  }

  drawReferencePoints() {
    Object.entries(referencePoints).forEach(([point, pos]) => {
      this.canvas.drawKeypoint(pos.x, pos.y, 'green');
      this.canvas.drawText(point, pos.x, pos.y);
    });
  }

  calculateAccuracy(pose) {
    let totalDistance = 0;
    let pointsCount = 0;
    
    pose.keypoints.forEach(keypoint => {
      const refPoint = referencePoints[keypoint.name];
      if (refPoint && keypoint.score > 0.3) {
        const distance = Math.sqrt(
          Math.pow(keypoint.x - refPoint.x, 2) + 
          Math.pow(keypoint.y - refPoint.y, 2)
        );
        totalDistance += distance;
        pointsCount++;
      }
    });

    if (pointsCount > 0) {
      const accuracy = Math.max(0, 100 - (totalDistance / pointsCount / 2));
      this.ui.updateAccuracy(accuracy);
    }
  }
}

// Initialize TensorFlow.js before starting the application
tf.ready().then(() => {
  const assistant = new YogaAssistant();
  assistant.init().catch(error => {
    console.error('Failed to initialize Yoga Assistant:', error);
  });
});