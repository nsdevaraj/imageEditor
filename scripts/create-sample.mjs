import sharp from 'sharp'

const photo = await sharp(
  new URL('../public/sample-photo.jpg', import.meta.url).pathname,
)
  .resize(820, 660, { fit: 'cover', position: 'centre' })
  .toBuffer()
async function text(content, font, color, width) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${content}</span>`,
      font,
      width,
      rgba: true,
    },
  })
    .png()
    .toBuffer()
}
await sharp({
  create: { width: 1000, height: 1250, channels: 3, background: '#f0f3ed' },
})
  .composite([
    {
      input: await text(
        'FIELD NOTES     /     VOL. 003',
        'Helvetica 23',
        '#3d5548',
        850,
      ),
      left: 90,
      top: 64,
    },
    {
      input: await text('Room to grow.', 'Helvetica Bold 105', '#193d2d', 850),
      left: 80,
      top: 147,
    },
    {
      input: await text(
        'A slower kind of living.',
        'Helvetica 31',
        '#3d5548',
        850,
      ),
      left: 90,
      top: 292,
    },
    { input: photo, left: 90, top: 390 },
    {
      input: await text(
        'THE EVERYDAY BOTANICAL',
        'Helvetica Bold 22',
        '#193d2d',
        650,
      ),
      left: 90,
      top: 1100,
    },
    {
      input: await text(
        'Objects. Spaces. Small rituals.',
        'Helvetica 22',
        '#3d5548',
        700,
      ),
      left: 90,
      top: 1144,
    },
  ])
  .png()
  .toFile(new URL('../public/sample-poster.png', import.meta.url).pathname)
