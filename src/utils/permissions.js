export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: 640,
        height: 480,
        facingMode: 'user'
      }
    });
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Camera permission denied. Please allow camera access to use the Yoga Assistant.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No camera found. Please connect a camera to use the Yoga Assistant.');
    } else {
      throw new Error(`Camera error: ${error.message}`);
    }
  }
}