import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { handleApiRequest } = require('../backend/apiHandler.js')

function backendApiPlugin() {
  return {
    name: 'shareaplate-backend-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          try {
            await handleApiRequest(req, res)
          } catch (err) {
            console.error('[API Middleware Error]:', err)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), backendApiPlugin()],
  server: {
    port: 5173,
  },
})
