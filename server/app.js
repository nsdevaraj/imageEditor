import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { applyTextEdits, normalizeScene } from '../shared/scene.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 1,
    fields: 4,
    fieldSize: 512 * 1024,
  },
})

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function parseField(value, name) {
  try {
    return JSON.parse(value)
  } catch {
    throw fail(`Invalid ${name} JSON.`)
  }
}

export function createApp(providers) {
  const app = express()
  app.disable('x-powered-by')
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store')
    if (
      request.headers.origin &&
      request.headers.origin !== `http://${request.headers.host}`
    ) {
      return response
        .status(403)
        .json({ error: 'Cross-origin requests are not allowed.' })
    }
    next()
  })
  app.get('/api/health', (_request, response) =>
    response.json({ status: 'ok' }),
  )

  async function inputs(request) {
    const keys = {
      deepseek: request.body.deepseekKey?.trim(),
      openai: request.body.openaiKey?.trim(),
    }
    if (!keys.deepseek || !keys.openai)
      throw fail(
        'Enter a DeepSeek key and an OpenAI image-provider key in Connections.',
      )
    if (keys.deepseek.length > 512 || keys.openai.length > 512)
      throw fail('An API key is too long.')
    if (!request.file) throw fail('Choose an image first.')
    try {
      const source = sharp(request.file.buffer, {
        limitInputPixels: 25000000,
        failOn: 'error',
      })
      const metadata = await source.metadata()
      if (
        !['png', 'jpeg', 'webp'].includes(metadata.format) ||
        metadata.pages > 1
      ) {
        throw new Error('Unsupported format')
      }
      const image = await source.rotate().png().toBuffer()
      if (image.length > 40 * 1024 * 1024)
        throw new Error('Decoded image is too large')
      return { image, keys }
    } catch {
      throw fail(
        'Use a valid, still PNG, JPEG or WebP image under 12 MB and 25 megapixels.',
      )
    }
  }

  function operation(callback) {
    return async (request, response, next) => {
      const controller = new AbortController()
      response.on('close', () => {
        if (!response.writableEnded) controller.abort()
      })
      try {
        const data = await inputs(request)
        await callback(request, response, {
          ...data,
          signal: controller.signal,
        })
      } catch (error) {
        next(error)
      }
    }
  }

  app.post(
    '/api/analyze',
    upload.single('image'),
    operation(async (_request, response, data) => {
      const scene = normalizeScene(await providers.analyze(data))
      response.json({ scene })
    }),
  )

  app.post(
    '/api/generate',
    upload.single('image'),
    operation(async (request, response, data) => {
      const original = parseField(request.body.scene, 'scene')
      const replacements = parseField(
        request.body.replacements,
        'text replacements',
      )
      let scene
      try {
        scene = applyTextEdits(original, replacements)
      } catch (error) {
        throw fail(error.message)
      }
      const image = await providers.generate({ ...data, scene })
      response.json({ image, scene })
    }),
  )

  app.use('/api', (_request, response) =>
    response.status(404).json({ error: 'API route not found.' }),
  )
  app.use((error, _request, response, _next) => {
    if (response.headersSent) return
    const status =
      error instanceof multer.MulterError ? 413 : error.status || 502
    let message =
      'The AI request failed. Check your keys, provider access and connection, then retry.'
    if (status === 401 || status === 403)
      message =
        'A provider rejected its API key or model access. Check both keys and account permissions.'
    if (status === 429)
      message =
        'A provider rate or balance limit was reached. Check your account balance and retry later.'
    if (status === 400)
      message =
        'The request was rejected. Check the image and selected model access.'
    if (status === 400 && !error.request_id && !error.error)
      message = error.message
    if (status === 413)
      message =
        'Upload a smaller image (maximum 12 MB) or reduce the JSON size.'
    response
      .status(status >= 400 && status < 600 ? status : 502)
      .json({ error: message })
  })
  return app
}
