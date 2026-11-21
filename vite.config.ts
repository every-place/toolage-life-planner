import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works on GitHub Pages under /toolage-life-planner/
// and anywhere else it is hosted.
export default defineConfig({
  base: './',
  plugins: [react()],
})
