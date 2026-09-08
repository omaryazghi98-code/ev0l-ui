import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certPath = process.env.EVOL_TLS_CERT || path.resolve(process.cwd(), 'certs/ev0l-lan.pem')
const keyPath = process.env.EVOL_TLS_KEY || path.resolve(process.cwd(), 'certs/ev0l-lan-key.pem')
const hasTls = fs.existsSync(certPath) && fs.existsSync(keyPath)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    ...(hasTls
      ? {
          https: {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          },
        }
      : {}),
    proxy: {
      '/api/system': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/library': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
    allowedHosts: ['6icko-ministation', 'ev0l-lan', 'ev0l.lan'],
  },
})
