import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyTextEdits,
  generationPrompt,
  normalizeScene,
} from '../shared/scene.js'

export const fixture = {
  meta: { image_type: 'Photo' },
  global_context: { scene_description: 'Two signs reading OPEN.' },
  color_palette: { dominant_hex_estimates: ['#ffffff'] },
  composition: { focal_point: 'Signs' },
  objects: [],
  text_ocr: {
    present: true,
    content: ['Left sign', 'Right sign'].map((location) => ({
      text: 'OPEN',
      location,
      font_style: 'Bold',
      legibility: 'Clear',
    })),
  },
  semantic_relationships: [],
}

test('equal text at different locations can be edited independently without mutating the original', () => {
  const original = structuredClone(fixture)
  const edited = applyTextEdits(original, { text_001: 'CLOSED' })
  assert.equal(edited.text_ocr.content[0].text, 'CLOSED')
  assert.equal(edited.text_ocr.content[1].text, 'OPEN')
  assert.equal(edited.text_edits[0].location, 'Left sign')
  assert.deepEqual(original, fixture)
})

test('supports deletion, multiline and Unicode replacements', () => {
  const edited = applyTextEdits(fixture, {
    text_001: '',
    text_002: 'Caf\u00e9\n\u65e5\u672c',
  })
  assert.equal(edited.text_ocr.content[0].text, '')
  assert.equal(edited.text_ocr.content[1].text, 'Caf\u00e9\n\u65e5\u672c')
  assert.equal(edited.text_edits.length, 2)
})

test('rejects stale IDs and malformed scene or edits', () => {
  assert.throws(() => applyTextEdits(fixture, { text_999: 'Other' }), /Invalid/)
  assert.throws(() => applyTextEdits(fixture, { text_001: null }), /Invalid/)
  assert.throws(() => normalizeScene({}), /missing/)
  assert.throws(
    () =>
      normalizeScene({
        ...fixture,
        text_ocr: { present: false, content: fixture.text_ocr.content },
      }),
    /inconsistent/,
  )
})

test('empty OCR remains usable and unchanged entries do not count as edits', () => {
  const empty = { ...fixture, text_ocr: { present: false, content: [] } }
  assert.deepEqual(applyTextEdits(empty).text_edits, [])
  assert.deepEqual(applyTextEdits(fixture, { text_001: 'OPEN' }).text_edits, [])
})

test('generation receives edited JSON and explicit precedence over original descriptions', () => {
  const edited = applyTextEdits(fixture, { text_001: 'CLOSED' })
  const prompt = generationPrompt(edited, 'Keep the original layout.')
  assert.ok(prompt.includes(JSON.stringify(edited)))
  assert.match(prompt, /authoritative/)
  assert.match(prompt, /untrusted visual data/)
})
