import test from 'node:test'
import assert from 'node:assert/strict'
import { providers } from '../server/providers.js'
import { applyTextEdits } from '../shared/scene.js'
import { sampleScene } from '../src/sample.js'

const keys = { deepseek: 'test-deepseek', openai: 'test-openai' }
const image = Buffer.from('fixture-image-bytes')

function chatResponse(content, finishReason = 'stop') {
  return Response.json({
    choices: [{ message: { content }, finish_reason: finishReason }],
  })
}

test('analysis uses vision first, then DeepSeek, while preserving observed OCR', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (input, options) => {
    const request = new Request(input, options)
    const body = await request.json()
    calls.push({ url: request.url, body })
    if (request.url.startsWith('https://api.openai.com/')) {
      assert.equal(request.headers.get('authorization'), 'Bearer test-openai')
      assert.equal(body.model, 'gpt-4.1-mini')
      assert.ok(
        body.messages[1].content[1].image_url.url.startsWith(
          'data:image/png;base64,',
        ),
      )
      assert.ok(body.messages[0].content.includes('VisionStruct'))
      return chatResponse(JSON.stringify(sampleScene))
    }
    assert.ok(request.url.startsWith('https://api.deepseek.com/'))
    assert.equal(request.headers.get('authorization'), 'Bearer test-deepseek')
    assert.equal(body.response_format.type, 'json_object')
    const rewritten = structuredClone(sampleScene)
    rewritten.text_ocr.content[0].text = 'Unwanted OCR rewrite'
    return chatResponse(JSON.stringify(rewritten))
  })
  const scene = await providers.analyze({ image, keys })
  assert.equal(calls.length, 2)
  assert.equal(
    scene.text_ocr.content[0].text,
    sampleScene.text_ocr.content[0].text,
  )
  assert.equal(scene.text_ocr.content[0].id, 'text_001')
})

test('generation sends edited JSON to DeepSeek and original image plus exact edits to image API', async (context) => {
  const scene = applyTextEdits(sampleScene, { text_002: 'Better days ahead.' })
  const calls = []
  context.mock.method(globalThis, 'fetch', async (input, options) => {
    const request = new Request(input, options)
    if (request.url.startsWith('data:')) return new Response('')
    calls.push(request.url)
    if (request.url.startsWith('https://api.deepseek.com/')) {
      const body = await request.json()
      assert.deepEqual(JSON.parse(body.messages[1].content), scene)
      return chatResponse(
        'Preserve the green typography and the existing photographic composition.',
      )
    }
    assert.equal(request.url, 'https://api.openai.com/v1/images/edits')
    const form = await request.formData()
    assert.equal(form.get('model'), 'gpt-image-1')
    assert.equal(form.get('input_fidelity'), 'high')
    assert.ok(form.get('prompt').includes(JSON.stringify(scene)))
    assert.ok(form.get('prompt').includes('Better days ahead.'))
    assert.equal(form.get('image').name, 'original.png')
    assert.deepEqual(Buffer.from(await form.get('image').arrayBuffer()), image)
    return Response.json({ data: [{ b64_json: 'fixture-generated-image' }] })
  })
  const result = await providers.generate({ image, scene, keys })
  assert.equal(calls.length, 2)
  assert.equal(result, 'data:image/png;base64,fixture-generated-image')
})

test('truncated analysis stops before passing incomplete data downstream', async (context) => {
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return chatResponse('{"meta":', 'length')
  })
  await assert.rejects(() => providers.analyze({ image, keys }), /too long/)
  assert.equal(calls, 1)
})
