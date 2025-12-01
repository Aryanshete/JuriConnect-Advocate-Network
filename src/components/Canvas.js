export class Canvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawKeypoint(x, y, color = 'blue', radius = 5) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawText(text, x, y, color = 'green') {
    this.ctx.fillStyle = color;
    this.ctx.font = '12px Arial';
    this.ctx.fillText(text, x + 10, y);
  }
}