import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow-models/pose-detection'
    ]
  }
});