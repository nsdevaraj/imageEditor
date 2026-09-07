import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from './app.js'
import { providers } from './providers.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const app = createApp(providers)
if (process.argv.includes('--production')) {
  app.use(express.static(`${root}/dist`))
  app.get('/{*path}', (_request, response) =>
    response.sendFile(`${root}/dist/index.html`),
  )
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

function listen(port) {
  const server = app.listen(port, '127.0.0.1', () =>
    console.log(`VisionStruct is running at http://127.0.0.1:${port}`),
  )
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < 65535) listen(port + 1)
    else throw error
  })
}
listen(Number(process.env.PORT) || 5173)
