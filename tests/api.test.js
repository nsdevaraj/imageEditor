import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import sharp from 'sharp'
import { createApp } from '../server/app.js'

const scene = {
  meta: {},
  global_context: {},
  color_palette: {},
  composition: {},
  objects: [],
  semantic_relationships: [],
  text_ocr: {
    present: true,
    content: [
      {
        text: 'HELLO',
        location: 'Center',
        font_style: 'Bold',
        legibility: 'Clear',
      },
    ],
  },
}
const image = await sharp({
  create: { width: 30, height: 20, channels: 3, background: '#ffffff' },
})
  .png()
  .toBuffer()
const keys = { deepseekKey: 'test-deepseek', openaiKey: 'test-openai' }

test('analysis validates the image, forwards keys and assigns stable text IDs', async () => {
  const app = createApp({
    analyze: async (input) => {
      assert.ok(Buffer.isBuffer(input.image))
      assert.equal(input.keys.deepseek, keys.deepseekKey)
      return scene
    },
  })
  const response = await request(app)
    .post('/api/analyze')
    .field(keys)
    .attach('image', image, 'image.png')
    .expect(200)
  assert.equal(response.body.scene.text_ocr.content[0].id, 'text_001')
  assert.equal(response.headers['cache-control'], 'no-store')
})

test('generation forwards the original image and independently edited JSON', async () => {
  const app = createApp({
    generate: async (input) => {
      assert.ok(input.image.length > 0)
      assert.equal(input.scene.text_ocr.content[0].text, 'GOODBYE')
      assert.equal(input.scene.text_edits[0].original_text, 'HELLO')
      return 'data:image/png;base64,result'
    },
  })
  const response = await request(app)
    .post('/api/generate')
    .field(keys)
    .field('scene', JSON.stringify(scene))
    .field('replacements', JSON.stringify({ text_001: 'GOODBYE' }))
    .attach('image', image, 'image.png')
    .expect(200)
  assert.equal(response.body.scene.text_ocr.content[0].text, 'GOODBYE')
})

test('rejects missing credentials, invalid image bytes and malformed JSON before provider calls', async () => {
  const app = createApp({})
  await request(app)
    .post('/api/analyze')
    .attach('image', image, 'image.png')
    .expect(400)
  await request(app)
    .post('/api/analyze')
    .field(keys)
    .attach('image', Buffer.from('not an image'), 'image.png')
    .expect(400)
  await request(app)
    .post('/api/generate')
    .field(keys)
    .field('scene', 'invalid')
    .field('replacements', '{}')
    .attach('image', image, 'image.png')
    .expect(400)
  await request(app)
    .post('/api/generate')
    .field(keys)
    .field('scene', JSON.stringify(scene))
    .field('replacements', '{"text_999":"bad"}')
    .attach('image', image, 'image.png')
    .expect(400)
})

test('rejects cross-origin requests and redacts provider errors', async () => {
  const app = createApp({
    analyze: async () => {
      throw Object.assign(new Error('secret-key-value'), { status: 401 })
    },
  })
  await request(app)
    .post('/api/analyze')
    .set('Origin', 'https://untrusted.example')
    .expect(403)
  const response = await request(app)
    .post('/api/analyze')
    .field(keys)
    .attach('image', image, 'image.png')
    .expect(401)
  assert.ok(!JSON.stringify(response.body).includes('secret-key-value'))
})
