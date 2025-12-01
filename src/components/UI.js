export class UI {
  constructor() {
    this.accuracyDisplay = document.getElementById('accuracy');
    this.errorDisplay = document.getElementById('error-message');
  }

  updateAccuracy(accuracy) {
    this.accuracyDisplay.textContent = `Pose Accuracy: ${accuracy.toFixed(1)}%`;
  }

  showError(message) {
    this.errorDisplay.textContent = message;
    this.errorDisplay.style.display = 'block';
  }

  hideError() {
    this.errorDisplay.style.display = 'none';
  }
}