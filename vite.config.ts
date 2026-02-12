import { defineConfig } from 'vite'
import path from 'path'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      entry: 'electron/main.ts',
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Importante para que o app ache os arquivos JS/CSS quando rodar localmente
  base: './', 
})