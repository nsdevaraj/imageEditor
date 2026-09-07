# VisionStruct Studio

A local three-step image editor based on [imagetojson.md](imagetojson.md).

1. Upload an image and analyze it into a scene JSON record.
2. Edit individual detected text regions. The JSON updates immediately and can be copied or downloaded.
3. Generate an image using the original image, edited JSON, and location-specific text replacements. Compare the original and result, then download the PNG.

## Run

Requires Node.js 22.12+ (tested with Node.js 24), npm, and internet access for AI requests.

```sh
cd app
npm install
npm run dev
```

Open the URL printed by the server, normally http://127.0.0.1:5173. If that port is occupied, the server selects the next available port.

## API Keys

Open **Connections** in the app and enter your keys there. Do not paste keys into chat or commit them to files.

- **DeepSeek API key:** JSON normalization and image-editing instructions, using the OpenAI-compatible DeepSeek API.
- **OpenAI API key:** image understanding and image generation. This implementation requires a separate image provider; a DeepSeek chat key alone cannot run the image stages. Your OpenAI account needs access to the configured models; image generation may require organization verification.

Keys stay in browser and server memory for requests. They are not saved to local storage, cookies, files, or logs. Reloading the page clears keys and workspace data. The local server sends images to OpenAI and scene JSON to DeepSeek; provider data-retention terms apply. API usage can incur charges. Canceling a request does not guarantee that a provider stops billing it.

Default model IDs can be overridden with server environment variables (not API keys):

| Variable         | Default         | Purpose                    |
| ---------------- | --------------- | -------------------------- |
| `DEEPSEEK_MODEL` | `deepseek-chat` | JSON and edit instructions |
| `VISION_MODEL`   | `gpt-4.1-mini`  | Image analysis             |
| `IMAGE_MODEL`    | `gpt-image-1`   | Image editing              |
| `PORT`           | `5173`          | Local server port          |

Model overrides must support the same API parameters as their defaults. Model availability and provider account permissions may change.

## Sample and Limits

**Try sample** loads a bundled poster and clearly labeled, hand-authored JSON. It does not call an AI service. Editing, copying, and downloading the sample JSON work without keys. Generating an image always requires real provider credentials; the app never substitutes a simulated image for an AI result.

- Supports still PNG, JPEG, and WebP files up to 12 MB and 25 megapixels. Convert unsupported image formats first.
- OCR is limited to 200 text regions per image. Dense images can exceed model response limits.
- The original prompt is loaded from disk by the server. Restart the server after changing it. Its conflicting code-fence instruction is overridden for the API; the UI displays JSON in a code panel with a copy button.
- Analysis is a best-effort visual description, not a pixel-exact representation. Illegible or unseen details cannot be recovered reliably.
- Each text entry has a stable ID and location. `text_ocr.content[].text` and `text_edits` contain the desired output. Other scene descriptions remain original context, so generation is explicitly instructed to prioritize the edit fields.
- An empty replacement removes a text region. Duplicate words in different regions can be edited independently.
- Image generation may change composition, dimensions, fonts, or other details despite the reference image. Exact lettering and complete visual preservation are not guaranteed.
- The server binds to localhost. This is a single-user local tool, not a public multi-user deployment. Add authentication, TLS, abuse controls, and appropriate provider-data policies before deploying remotely.

The sample photograph is from [Unsplash's image CDN](https://images.unsplash.com/photo-1416879595882-3373a0480b5b), showing a gardening trowel, soil, and gardening materials. The poster bitmap is reproducible with `node scripts/create-sample.mjs` from the app directory.

## Verification

```sh
cd app
npm test
npm run lint
npm run build
```

With the app running, run browser tests using an installed Google Chrome:

```sh
npm run test:browser
```

Alternatively, run `npx playwright install chromium`, then `PLAYWRIGHT_CHANNEL=chromium npm run test:browser`. For another server port, set `APP_URL`, for example `APP_URL=http://127.0.0.1:5174 npm run test:browser`.

Browser tests cover desktop, mobile, and small mobile. Paid AI calls are mocked in automated tests. Real provider authentication, billing, model availability, and image quality require live credentials and were not verified during setup.

To serve a built version, run `npm run build` followed by `npm run preview`. The preview command includes the API server.
