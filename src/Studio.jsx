import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Expand,
  FileImage,
  ImagePlus,
  KeyRound,
  Layers2,
  LoaderCircle,
  ScanLine,
  Settings2,
  Sparkles,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { applyTextEdits, normalizeScene } from '../shared/scene.js'
import { sampleScene } from './sample.js'
import './studio.css'

const stages = [
  { title: 'Image to JSON', icon: ScanLine },
  { title: 'Edit text', icon: Type },
  { title: 'Generate image', icon: Sparkles },
]
const emptyKeys = { deepseekKey: '', openaiKey: '' }

function download(data, filename, type) {
  const objectUrl = type
    ? URL.createObjectURL(new Blob([data], { type }))
    : null
  const anchor = document.createElement('a')
  anchor.href = objectUrl || data
  anchor.download = filename
  anchor.click()
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function IconButton({ label, children, ...props }) {
  return (
    <button
      className="icon-button"
      type="button"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}

function Studio() {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState(null)
  const [previewDimensions, setPreviewDimensions] = useState({
    width: 1000,
    height: 1250,
  })
  const [scene, setScene] = useState(null)
  const [replacements, setReplacements] = useState({})
  const [result, setResult] = useState(null)
  const [view, setView] = useState('original')
  const [keys, setKeys] = useState(emptyKeys)
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [isSample, setIsSample] = useState(false)
  const input = useRef(null)
  const dialog = useRef(null)
  const previewDialog = useRef(null)
  const requestController = useRef(null)
  const uploadSequence = useRef(0)
  const editedScene = scene ? applyTextEdits(scene, replacements) : null
  const changes = editedScene?.text_edits || []
  const json = editedScene ? JSON.stringify(editedScene, null, 2) : ''
  const connectedCount = Object.values(keys).filter((key) => key.trim()).length
  const activeImage =
    view === 'generated' && result
      ? result.image
      : source?.url || '/sample-poster.png'

  useEffect(
    () => () => {
      if (source?.url) URL.revokeObjectURL(source.url)
    },
    [source],
  )
  useEffect(() => () => requestController.current?.abort(), [])
  useEffect(() => {
    if (connectionsOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [connectionsOpen])
  useEffect(() => {
    if (expanded) previewDialog.current?.showModal()
    else previewDialog.current?.close()
  }, [expanded])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timeout)
  }, [notice])

  async function loadImage(file, sample = false) {
    if (!file || busy) return
    const sequence = ++uploadSequence.current
    setError('')
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG or WebP image up to 12 MB.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      if (dimensions.width * dimensions.height > 25000000)
        throw new Error('Choose an image under 25 megapixels.')
      if (sequence !== uploadSequence.current) return
      setSource({ file, url: URL.createObjectURL(file), ...dimensions })
      setScene(sample ? normalizeScene(sampleScene) : null)
      setReplacements({})
      setResult(null)
      setView('original')
      setIsSample(sample)
      setStep(1)
    } catch (failure) {
      setError(failure.message || 'This image could not be opened.')
    }
  }

  async function loadSample() {
    try {
      const response = await fetch('/sample-poster.png')
      if (!response.ok) throw new Error('The sample image could not be loaded.')
      await loadImage(
        new File([await response.blob()], 'field-notes.png', {
          type: 'image/png',
        }),
        true,
      )
    } catch (failure) {
      setError(failure.message)
    }
  }

  function updateText(id, text) {
    setReplacements((previous) => ({ ...previous, [id]: text }))
    setResult(null)
    setView('original')
  }

  function cancelRequest() {
    requestController.current?.abort()
    setBusy(null)
    setNotice('Request canceled. Provider charges may still apply.')
  }

  async function runAI(action) {
    if (!source || busy) return
    if (connectedCount < 2) {
      setConnectionsOpen(true)
      return
    }
    const controller = new AbortController()
    requestController.current = controller
    setBusy(action)
    setError('')
    const body = new FormData()
    body.append('image', source.file)
    body.append('deepseekKey', keys.deepseekKey.trim())
    body.append('openaiKey', keys.openaiKey.trim())
    if (action === 'generate') {
      body.append('scene', JSON.stringify(scene))
      body.append('replacements', JSON.stringify(replacements))
    }
    try {
      const response = await fetch(`/api/${action}`, {
        method: 'POST',
        body,
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The AI request failed.')
      if (controller.signal.aborted) return
      if (action === 'analyze') {
        setScene(normalizeScene(data.scene))
        setReplacements({})
        setResult(null)
        setIsSample(false)
        setView('original')
        setStep(2)
      } else {
        if (!data.image?.startsWith('data:image/'))
          throw new Error('The provider returned an invalid image.')
        setResult(data)
        setView('generated')
        setStep(3)
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure.message || 'Could not reach the local server.')
    } finally {
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  async function copyJSON() {
    try {
      await navigator.clipboard.writeText(json)
      setNotice('JSON copied')
    } catch {
      setError('Clipboard access was denied. Download the JSON instead.')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="VisionStruct home">
          <span className="brand-mark">
            <ScanLine size={23} />
          </span>
          VisionStruct<span className="brand-label">STUDIO</span>
        </a>
        <button
          className="secondary connection-button"
          onClick={() => setConnectionsOpen(true)}
        >
          <KeyRound size={15} />
          <span>Connections</span>
          <span
            className={`connection-dot ${connectedCount === 2 ? 'ready' : ''}`}
          />
          <span className="connection-count">{connectedCount}/2</span>
        </button>
      </header>

      <main>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow">IMAGE WORKSPACE</div>
            <h1>{source ? source.file.name : 'Untitled image'}</h1>
          </div>
          <button
            className="secondary"
            disabled={!!busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            <span>Upload image</span>
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload image file"
          className="file-input"
          disabled={!!busy}
          onChange={(event) => {
            loadImage(event.target.files[0])
            event.target.value = ''
          }}
        />

        <nav className="steps" aria-label="Workflow steps">
          {stages.map(({ title, icon: StageIcon }, index) => (
            <button
              key={title}
              className={`step ${step === index + 1 ? 'active' : ''} ${(scene && index === 0) || (result && index === 1) ? 'complete' : ''}`}
              aria-current={step === index + 1 ? 'step' : undefined}
              disabled={!!busy || (index > 0 && !scene)}
              onClick={() => setStep(index + 1)}
            >
              <span className="step-number">
                {(scene && index === 0) || (result && index === 1) ? (
                  <Check size={16} />
                ) : (
                  `0${index + 1}`
                )}
              </span>
              <StageIcon size={17} className="step-icon" />
              <span>{title}</span>
              <ChevronRight className="step-arrow" size={17} />
            </button>
          ))}
        </nav>

        {error && (
          <div role="alert" className="error-banner">
            <span>{error}</span>
            <IconButton label="Dismiss error" onClick={() => setError('')}>
              <X size={17} />
            </IconButton>
          </div>
        )}

        <div className="workspace">
          <section className="image-panel" aria-label="Image preview">
            <div className="panel-toolbar">
              <div className="panel-title">
                <FileImage size={16} />
                {view === 'generated' ? 'Generated image' : 'Source image'}
                {isSample && <span className="tag">SAMPLE</span>}
              </div>
              <div className="toolbar-actions">
                {result && (
                  <div className="segmented" aria-label="Image comparison">
                    <button
                      aria-pressed={view === 'original'}
                      onClick={() => setView('original')}
                    >
                      Original
                    </button>
                    <button
                      aria-pressed={view === 'generated'}
                      onClick={() => setView('generated')}
                    >
                      Generated
                    </button>
                  </div>
                )}
                <IconButton
                  label="Expand image"
                  onClick={() => setExpanded(true)}
                >
                  <Expand size={16} />
                </IconButton>
                {source && (
                  <IconButton
                    label="Replace image"
                    disabled={!!busy}
                    onClick={() => input.current?.click()}
                  >
                    <ImagePlus size={17} />
                  </IconButton>
                )}
              </div>
            </div>
            <div
              className={`canvas ${dragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                if (!busy) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                if (!busy) loadImage(event.dataTransfer.files[0])
              }}
            >
              <div className="canvas-ruler horizontal" aria-hidden="true">
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                  <span key={fraction}>
                    {Math.round(previewDimensions.width * fraction)}
                  </span>
                ))}
              </div>
              <img
                className={`preview-image ${!source ? 'sample-preview' : ''}`}
                src={activeImage}
                onLoad={(event) =>
                  setPreviewDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                alt={
                  source
                    ? view === 'generated'
                      ? 'AI generated image with revised text'
                      : 'Original uploaded image'
                    : 'Sample editorial poster with plants and the headline Room to grow.'
                }
              />
              {!source && (
                <div className="sample-action">
                  <span>
                    <span className="tiny-dot" />
                    FIELD NOTES / SAMPLE
                  </span>
                  <button onClick={loadSample}>
                    Try sample
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {dragging && (
                <div className="drop-overlay">
                  <Upload size={30} />
                  <span>Drop image</span>
                </div>
              )}
              {busy && (
                <div className="busy-overlay">
                  <LoaderCircle className="spin" size={28} />
                  <strong>
                    {busy === 'analyze'
                      ? 'Analyzing visual details'
                      : 'Generating your image'}
                  </strong>
                  <span>
                    {busy === 'analyze'
                      ? 'Vision + DeepSeek'
                      : 'DeepSeek + image model'}
                  </span>
                  <button className="secondary" onClick={cancelRequest}>
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="canvas-footer">
              <span>
                <span className="tiny-dot" />
                {`${previewDimensions.width} x ${previewDimensions.height} px`}
              </span>
              <span>
                {view === 'generated'
                  ? 'PNG'
                  : source
                    ? `${(source.file.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Sample preview'}
                <span className="footer-divider">/</span>Fit to canvas
              </span>
            </div>
          </section>

          <aside className="inspector">
            <div className="inspector-heading">
              <span className="eyebrow">STEP 0{step}</span>
              <span className="outline-icon">
                {step === 1 ? (
                  <ScanLine size={21} />
                ) : step === 2 ? (
                  <Type size={21} />
                ) : (
                  <Sparkles size={21} />
                )}
              </span>
            </div>
            <h2>
              {step === 1
                ? 'Image analysis'
                : step === 2
                  ? 'Text regions'
                  : 'Image generation'}
            </h2>
            <div className="section-subtitle">
              {step === 1
                ? 'VisionStruct schema'
                : step === 2
                  ? `${scene.text_ocr.content.length} text regions`
                  : `${changes.length} text ${changes.length === 1 ? 'change' : 'changes'}`}
              {isSample && <span className="sample-label">Sample data</span>}
            </div>

            {step === 1 && (
              <>
                <div className="properties">
                  <div>
                    <span>Source</span>
                    <strong>
                      {source ? source.file.name : 'No image selected'}
                    </strong>
                  </div>
                  <div>
                    <span>Format</span>
                    <strong>
                      {source
                        ? source.file.type.split('/')[1].toUpperCase()
                        : '--'}
                    </strong>
                  </div>
                  <div>
                    <span>Analysis schema</span>
                    <strong>VisionStruct JSON</strong>
                  </div>
                </div>
                <div className="section-label">
                  PROVIDERS
                  <button
                    className="text-button"
                    onClick={() => setConnectionsOpen(true)}
                  >
                    <Settings2 size={13} />
                    Configure
                  </button>
                </div>
                <div className="provider-line">
                  <span className="provider-icon deepseek">
                    <Braces size={17} />
                  </span>
                  <div>
                    <strong>DeepSeek</strong>
                    <span>JSON processing</span>
                  </div>
                  <span
                    className={`provider-status ${keys.deepseekKey.trim() ? 'entered' : ''}`}
                  >
                    {keys.deepseekKey.trim() ? 'Key entered' : 'Key required'}
                  </span>
                </div>
                <div className="provider-line">
                  <span className="provider-icon openai">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <strong>OpenAI</strong>
                    <span>Vision + image generation</span>
                  </div>
                  <span
                    className={`provider-status ${keys.openaiKey.trim() ? 'entered' : ''}`}
                  >
                    {keys.openaiKey.trim() ? 'Key entered' : 'Key required'}
                  </span>
                </div>
                <div className="inspector-actions">
                  {source ? (
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() => runAI('analyze')}
                    >
                      <ScanLine size={17} />
                      {busy === 'analyze'
                        ? 'Analyzing...'
                        : scene
                          ? 'Analyze again with AI'
                          : 'Analyze image'}
                      <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => input.current?.click()}
                    >
                      <Upload size={17} />
                      Choose image
                      <ArrowRight size={17} />
                    </button>
                  )}
                  {scene && (
                    <button
                      className="secondary wide"
                      onClick={() => setStep(2)}
                      disabled={!!busy}
                    >
                      Edit detected text
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                <div className="supported-formats">
                  PNG, JPG, WEBP<span>Up to 12 MB</span>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-list">
                  {scene.text_ocr.content.length === 0 ? (
                    <div className="empty-state">
                      <Type size={25} />
                      <strong>No readable text detected</strong>
                    </div>
                  ) : (
                    scene.text_ocr.content.map((entry, index) => {
                      const text = replacements[entry.id] ?? entry.text
                      const changed = text !== entry.text
                      return (
                        <div
                          className={`text-entry ${changed ? 'edited' : ''}`}
                          key={entry.id}
                        >
                          <div className="text-entry-heading">
                            <span className="text-index">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span>
                              {entry.location || 'Unspecified location'}
                            </span>
                            {changed && (
                              <IconButton
                                label={`Reset text ${index + 1}`}
                                disabled={!!busy}
                                onClick={() => updateText(entry.id, entry.text)}
                              >
                                <Undo2 size={14} />
                              </IconButton>
                            )}
                          </div>
                          <div className="original-text">{entry.text}</div>
                          <textarea
                            aria-label={`Replacement text ${index + 1}`}
                            value={text}
                            maxLength={10000}
                            disabled={!!busy}
                            rows={Math.min(
                              5,
                              Math.max(2, text.split('\n').length),
                            )}
                            onChange={(event) =>
                              updateText(entry.id, event.target.value)
                            }
                          />
                          <div className="text-meta">
                            <span>
                              {entry.font_style || 'Unspecified font'}
                            </span>
                            <span>
                              {changed
                                ? 'Edited'
                                : entry.legibility || 'Unspecified legibility'}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="inspector-actions">
                  <button
                    className="primary"
                    onClick={() => setStep(3)}
                    disabled={!!busy}
                  >
                    Continue to generation
                    <ArrowRight size={17} />
                  </button>
                  <button
                    className="text-button centered"
                    disabled={!changes.length || !!busy}
                    onClick={() => {
                      setReplacements({})
                      setResult(null)
                      setView('original')
                    }}
                  >
                    <Undo2 size={14} />
                    Reset all changes
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="generation-summary">
                  <div className="section-label">
                    TEXT CHANGES
                    <button
                      className="text-button"
                      onClick={() => setStep(2)}
                      disabled={!!busy}
                    >
                      <Type size={13} />
                      Edit
                    </button>
                  </div>
                  {changes.length === 0 ? (
                    <p className="muted">
                      No text changes. Generate a reconstruction of the
                      original.
                    </p>
                  ) : (
                    changes.map((change) => (
                      <div className="change-row" key={change.id}>
                        <span>{change.location}</span>
                        <del>{change.original_text}</del>
                        <strong>
                          <ArrowRight size={13} />
                          {change.replacement_text || '(Remove text)'}
                        </strong>
                      </div>
                    ))
                  )}
                </div>
                <div className="properties">
                  <div>
                    <span>Reference</span>
                    <strong>Original image + edited JSON</strong>
                  </div>
                  <div>
                    <span>Image quality</span>
                    <strong>High</strong>
                  </div>
                  <div>
                    <span>Composition</span>
                    <strong>Preserve original</strong>
                  </div>
                </div>
                <p className="generation-disclaimer">
                  AI may alter layout or miss exact lettering. Review the
                  generated image before use.
                </p>
                <div className="inspector-actions">
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={() => runAI('generate')}
                  >
                    <Sparkles size={17} />
                    {busy === 'generate'
                      ? 'Generating...'
                      : result
                        ? 'Generate again'
                        : 'Generate image'}
                    <ArrowRight size={17} />
                  </button>
                  {result && (
                    <button
                      className="secondary wide"
                      onClick={() =>
                        download(result.image, 'visionstruct-edited.png')
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Download image
                    </button>
                  )}
                  <button
                    className="text-button centered"
                    disabled={!!busy}
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft size={14} />
                    Back to text
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>

        <section className="json-section" aria-label="Scene JSON">
          <div className="json-toolbar">
            <div className="panel-title">
              <Braces size={17} />
              <h2>Scene JSON</h2>
              <span className="tag">
                {scene
                  ? changes.length
                    ? 'EDITED'
                    : 'READY'
                  : 'AWAITING IMAGE'}
              </span>
            </div>
            <div className="toolbar-actions">
              <span className="json-size">
                {json
                  ? `${(new Blob([json]).size / 1024).toFixed(1)} KB`
                  : 'JSON'}
              </span>
              <IconButton
                label="Copy JSON"
                disabled={!scene}
                onClick={copyJSON}
              >
                <Copy size={16} />
              </IconButton>
              <IconButton
                label="Download JSON"
                disabled={!scene}
                onClick={() =>
                  download(json, 'visionstruct-scene.json', 'application/json')
                }
              >
                <ArrowDownToLine size={16} />
              </IconButton>
            </div>
          </div>
          {scene ? (
            <pre tabIndex={0}>
              <code>{json}</code>
            </pre>
          ) : (
            <div className="json-empty">
              <Braces size={23} />
              <span>No scene data yet</span>
              <span className="empty-json-mark">{'{ }'}</span>
            </div>
          )}
        </section>
        <footer className="app-footer">
          <span>
            <Layers2 size={14} />
            VisionStruct Studio
          </span>
          <span>
            DeepSeek + OpenAI<span className="footer-divider">/</span>Keys kept
            in memory only
          </span>
        </footer>
      </main>

      <dialog
        ref={dialog}
        className="connections-dialog"
        onCancel={() => setConnectionsOpen(false)}
        onClose={() => setConnectionsOpen(false)}
        aria-labelledby="connections-title"
      >
        <div className="modal-header">
          <span className="outline-icon">
            <KeyRound size={21} />
          </span>
          <IconButton
            label="Close connections"
            onClick={() => setConnectionsOpen(false)}
          >
            <X size={20} />
          </IconButton>
        </div>
        <h2 id="connections-title">Connections</h2>
        <p className="modal-description">
          DeepSeek processes JSON. A separate image provider is required for
          vision and image generation.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setConnectionsOpen(false)
          }}
          autoComplete="off"
        >
          <label htmlFor="deepseek-key">
            DeepSeek API key<span>JSON + edit instructions</span>
          </label>
          <input
            id="deepseek-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={512}
            placeholder="sk-..."
            value={keys.deepseekKey}
            onChange={(event) =>
              setKeys({ ...keys, deepseekKey: event.target.value })
            }
          />
          <a
            className="key-link"
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noreferrer"
          >
            DeepSeek API keys
            <ArrowRight size={12} />
          </a>
          <label htmlFor="openai-key">
            OpenAI API key<span>Image analysis + generation</span>
          </label>
          <input
            id="openai-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={512}
            placeholder="sk-..."
            value={keys.openaiKey}
            onChange={(event) =>
              setKeys({ ...keys, openaiKey: event.target.value })
            }
          />
          <a
            className="key-link"
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            OpenAI API keys
            <ArrowRight size={12} />
          </a>
          <div className="privacy-note">
            <KeyRound size={16} />
            <p>
              Keys are held in memory, never saved. Images are sent to OpenAI;
              scene JSON is sent to DeepSeek. Both providers may charge for
              requests.
            </p>
          </div>
          <button className="primary" type="submit">
            <CheckCheck size={17} />
            Done
          </button>
          <button
            className="text-button centered"
            type="button"
            onClick={() => setKeys(emptyKeys)}
          >
            Clear keys
          </button>
        </form>
      </dialog>
      <dialog
        ref={previewDialog}
        className="preview-dialog"
        onCancel={() => setExpanded(false)}
        onClose={() => setExpanded(false)}
        aria-label="Expanded image preview"
      >
        <IconButton
          label="Close image preview"
          onClick={() => setExpanded(false)}
        >
          <X size={21} />
        </IconButton>
        <img src={activeImage} alt="Expanded image preview" />
      </dialog>
      <div
        role="status"
        aria-live="polite"
        className={`toast ${notice ? 'visible' : ''}`}
      >
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </div>
    </div>
  )
}

export default Studio
