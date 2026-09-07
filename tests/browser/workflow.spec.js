import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { sampleScene } from '../../src/sample.js'

const posterFile = new URL('../../public/sample-poster.png', import.meta.url)
  .pathname
const poster = await readFile(posterFile)
const generatedImage = `data:image/png;base64,${(await sharp(poster).resize(512, 640).png().toBuffer()).toString('base64')}`

async function enterKeys(page) {
  await page.getByRole('button', { name: /Connections/ }).click()
  await page.getByLabel('DeepSeek API key').fill('test-deepseek-only')
  await page.getByLabel('OpenAI API key').fill('test-openai-only')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
}

async function expectNoOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const overflowingButtons = await page
    .locator('button:visible')
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => button.scrollWidth > button.clientWidth + 2)
        .map((button) => button.textContent),
    )
  expect(overflowingButtons).toEqual([])
}

test('initial workspace has a rendered image and usable responsive controls', async ({
  page,
}, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Untitled image' }),
  ).toBeVisible()
  await expect(page.locator('.preview-image')).toHaveJSProperty(
    'naturalWidth',
    1000,
  )
  await page.evaluate(() => document.fonts.ready)
  await expectNoOverflow(page)
  const statistics = await sharp(
    await page.locator('.canvas').screenshot(),
  ).stats()
  expect(statistics.entropy).toBeGreaterThan(3)
  await page.screenshot({
    path: testInfo.outputPath('workspace.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Expand image', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Expanded image preview' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close image preview' }).click()
  await page.getByRole('button', { name: /Connections/ }).click()
  await expect(page.getByLabel('DeepSeek API key')).toHaveAttribute(
    'type',
    'password',
  )
  await expectNoOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('connections.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Close connections' }).click()
  expect(errors).toEqual([])
})

test('sample text edits update valid JSON, copy, download and reset', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try sample' }).click()
  await page.getByRole('button', { name: 'Edit detected text' }).click()
  await expect(
    page.getByLabel('Replacement text 2', { exact: true }),
  ).toHaveValue('Room to grow.')
  await page
    .getByLabel('Replacement text 2', { exact: true })
    .fill('A little more green.\nCaf\u00e9 \u65e5\u672c')
  const scene = JSON.parse(await page.locator('pre code').textContent())
  expect(scene.text_ocr.content[1].text).toBe(
    'A little more green.\nCaf\u00e9 \u65e5\u672c',
  )
  expect(scene.text_ocr.content[0].text).toBe(
    sampleScene.text_ocr.content[0].text,
  )
  await page.getByRole('button', { name: 'Copy JSON', exact: true }).click()
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
      .text_edits,
  ).toHaveLength(1)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe(
    'visionstruct-scene.json',
  )
  await expectNoOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('text-editing.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Continue to generation' }).click()
  await expect(
    page.getByRole('heading', { name: 'Image generation' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Generate image', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Connections', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close connections' }).click()
  await page.getByRole('button', { name: 'Back to text' }).click()
  await page.getByRole('button', { name: 'Reset all changes' }).click()
  await expect(
    page.getByLabel('Replacement text 2', { exact: true }),
  ).toHaveValue('Room to grow.')
})

test('upload, AI analysis and generation send the edited text with the original image', async ({
  page,
}, testInfo) => {
  let generateBody = ''
  await page.route('**/api/analyze', (route) =>
    route.fulfill({ json: { scene: sampleScene } }),
  )
  await page.route('**/api/generate', async (route) => {
    generateBody = route.request().postDataBuffer().toString()
    await route.fulfill({ json: { image: generatedImage } })
  })
  await page.goto('/')
  await enterKeys(page)
  await page.getByLabel('Upload image file').setInputFiles(posterFile)
  await page.getByRole('button', { name: 'Analyze image', exact: true }).click()
  await page
    .getByLabel('Replacement text 2', { exact: true })
    .fill('Better days ahead.')
  await page.getByRole('button', { name: 'Continue to generation' }).click()
  await page
    .getByRole('button', { name: 'Generate image', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Download image', exact: true }),
  ).toBeVisible()
  expect(generateBody).toContain('Better days ahead.')
  expect(generateBody).toContain('name="image"; filename="sample-poster.png"')
  expect(generateBody).toContain('test-deepseek-only')
  await page.getByRole('button', { name: 'Original', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Original uploaded image' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Generated', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'AI generated image with revised text' }),
  ).toBeVisible()
  await expect(page.locator('.canvas-footer')).toContainText('512 x 640 px')
  await expectNoOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('generation.png'),
    fullPage: true,
  })
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download image', exact: true })
    .click()
  expect((await downloadPromise).suggestedFilename()).toBe(
    'visionstruct-edited.png',
  )
  await page.getByRole('button', { name: 'Back to text' }).click()
  await page
    .getByLabel('Replacement text 2', { exact: true })
    .fill('A changed version')
  await page.getByRole('button', { name: 'Continue to generation' }).click()
  await expect(
    page.getByRole('button', { name: 'Download image', exact: true }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 })
  await page.reload()
  await page.getByRole('button', { name: /Connections/ }).click()
  await expect(page.getByLabel('DeepSeek API key')).toHaveValue('')
  await expect(page.getByLabel('OpenAI API key')).toHaveValue('')
})

test('provider errors preserve the source and retry can produce an empty-text scene', async ({
  page,
}) => {
  let attempts = 0
  await page.route('**/api/analyze', (route) => {
    attempts += 1
    return attempts === 1
      ? route.fulfill({
          status: 429,
          json: { error: 'Provider balance limit reached.' },
        })
      : route.fulfill({
          json: {
            scene: {
              ...sampleScene,
              text_ocr: { present: false, content: [] },
            },
          },
        })
  })
  await page.goto('/')
  await enterKeys(page)
  await page.getByLabel('Upload image file').setInputFiles(posterFile)
  await page.getByRole('button', { name: 'Analyze image', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Provider balance limit reached.',
  )
  await expect(
    page.getByRole('img', { name: 'Original uploaded image' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Analyze image', exact: true }).click()
  await expect(page.getByText('No readable text detected')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to generation' }).click()
  await expect(
    page.getByText(
      'No text changes. Generate a reconstruction of the original.',
    ),
  ).toBeVisible()
})

test('canceling analysis prevents stale results and restores controls', async ({
  page,
}) => {
  let releaseRequest
  const pendingRequest = new Promise((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/analyze', async (route) => {
    await pendingRequest
    await route.fulfill({ json: { scene: sampleScene } }).catch(() => {})
  })
  await page.goto('/')
  await enterKeys(page)
  await page.getByLabel('Upload image file').setInputFiles(posterFile)
  await page.getByRole('button', { name: 'Analyze image', exact: true }).click()
  await expect(page.getByText('Analyzing visual details')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  releaseRequest()
  await expect(
    page.getByRole('button', { name: 'Analyze image', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('heading', { name: 'Image analysis' }),
  ).toBeVisible()
})
