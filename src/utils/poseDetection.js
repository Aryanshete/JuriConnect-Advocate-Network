import * as poseDetection from '@tensorflow-models/pose-detection';

export async function initializePoseDetector() {
  try {
    const detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.3
      }
    );
    return detector;
  } catch (error) {
    throw new Error(`Failed to initialize pose detector: ${error.message}`);
  }
}