import { useCallback, useEffect, useRef, useState } from "react"

/** Font sizes offered in the ribbon (pt). */
const FONT_SIZES = [8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

const FONTS = ["Arial", "Times New Roman", "Calibri", "Courier New", "Verdana", "Georgia"]

/** Line spacing presets, named the way Word names them. */
const LINE_SPACINGS = [
  { label: "Single", value: 1 },
  { label: "1.5 lines", value: 1.5 },
  { label: "Double", value: 2 },
]

const HIGHLIGHTS = [
  { label: "Yellow", value: "#FFFF00" },
  { label: "Green", value: "#00FF00" },
  { label: "Cyan", value: "#00FFFF" },
  { label: "No fill", value: "transparent" },
]

/** Alignment, named as in the Word ribbon. */
const ALIGNMENTS = [
  { command: "justifyLeft", label: "Left" },
  { command: "justifyCenter", label: "Center" },
  { command: "justifyRight", label: "Right" },
  { command: "justifyFull", label: "Justify" },
]

/** 0.5 inch of indent, in CSS pixels (96 dpi). */
const HALF_INCH = 48

/** Toolbar button used across the ribbon. */
function ToolButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-md border border-transparent px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-page hover:text-brand ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Thin vertical divider between ribbon groups. */
const Divider = () => <span className="h-6 w-px bg-border" aria-hidden="true" />

/**
 * Each part keeps its own document, keyed so that moving between the part tabs
 * (which unmounts this component) never destroys the student's typing.
 * `localStorage` also survives an accidental refresh mid-exam.
 */
const storageKeyFor = (part, partLetter) =>
  `pracoffice:doc:${String(part?.name || "part").toLowerCase()}:${partLetter}`

const readStoredDoc = (key) => {
  try {
    return localStorage.getItem(key) || ""
  } catch {
    // Private browsing / disabled storage: the document stays in memory only.
    return ""
  }
}

const writeStoredDoc = (key, html) => {
  try {
    localStorage.setItem(key, html)
  } catch {
    // Quota exceeded or storage disabled - not worth interrupting the exam for.
  }
}

/**
 * A Word-compatible editor that runs entirely in the page.
 *
 * The exam's Word part is a formatting exercise (Arial 12 pt, justified, 0.5"
 * first-line indent, double line spacing, a bold underlined centred header, a
 * yellow highlight and a boxed paragraph), so the ribbon exposes exactly those
 * controls and applies them with `document.execCommand`, the rich-text model
 * every browser already implements.
 *
 * This is the dependable path: it needs no Microsoft account, no document
 * sharing and no network, so the Word workspace is never missing mid-exam.
 */
function WordWorkspace({ part, partLetter, questionLabel }) {
  const editorRef = useRef(null)
  const [counts, setCounts] = useState({ words: 0, chars: 0 })

  // One document per part, so the part tabs do not wipe each other.
  const storageKey = storageKeyFor(part, partLetter)

  /** Persists the document and refreshes the word/character counter. */
  const saveDocument = useCallback(() => {
    const editor = editorRef.current

    if (!editor) return

    writeStoredDoc(storageKey, editor.innerHTML)

    const text = editor.innerText.trim()

    setCounts({
      words: text ? text.split(/\s+/).length : 0,
      chars: text.length,
    })
  }, [storageKey])

  /**
   * Runs a rich-text command on the current selection. The editor is refocused
   * first so clicking a toolbar button never drops the student's selection.
   */
  const exec = useCallback((command, value = null) => {
    editorRef.current?.focus()
    // styleWithCSS makes font/size/colour real CSS instead of legacy tags.
    document.execCommand("styleWithCSS", false, true)
    document.execCommand(command, false, value)
  }, [])

  /** The block element (paragraph / div / heading) holding the caret. */
  const activeBlock = useCallback(() => {
    const node = window.getSelection()?.anchorNode
    const element = node?.nodeType === 1 ? node : node?.parentElement

    return element?.closest("p, div, li, h1, h2, h3") || null
  }, [])

  // Count once on mount, then on every keystroke. The page itself is
  // uncontrolled, so counting never re-renders the document content.
  useEffect(() => {
    const text = editorRef.current?.innerText.trim() || ""

    setCounts({
      words: text ? text.split(/\s+/).length : 0,
      chars: text.length,
    })
  }, [])

  /**
   * Restores this part's saved document. Assigned as plain HTML because the
   * stored value is this editor's own markup.
   */
  useEffect(() => {
    const saved = readStoredDoc(storageKey)

    if (saved && editorRef.current && !editorRef.current.innerHTML.trim()) {
      editorRef.current.innerHTML = saved
    }
  }, [storageKey])

  /** Line spacing is a block style, so it is set on the caret's block. */
  const applyLineSpacing = (value) => {
    const block = activeBlock()

    if (block) block.style.lineHeight = String(value)

    editorRef.current?.focus()
    saveDocument()
  }

  /** Toggles the box the exam asks for around the second paragraph. */
  const toggleBox = () => {
    const block = activeBlock()

    if (!block) return

    const boxed = block.dataset.boxed === "true"

    block.dataset.boxed = String(!boxed)
    block.style.border = boxed ? "" : "1px solid #172033"
    block.style.padding = boxed ? "" : "8px"

    editorRef.current?.focus()
    saveDocument()
  }

  /** Increases or decreases the left indent of the caret's block. */
  const nudgeIndent = (delta) => {
    const block = activeBlock()

    if (!block) return

    const current = parseFloat(block.style.marginLeft) || 0
    block.style.marginLeft = `${Math.max(0, current + delta * HALF_INCH)}px`

    editorRef.current?.focus()
    saveDocument()
  }

  /** 0.5" first-line indent on the caret's block (exam task a3). */
  const toggleFirstLineIndent = () => {
    const block = activeBlock()

    if (!block) return

    const on = parseFloat(block.style.textIndent) === HALF_INCH
    block.style.textIndent = on ? "" : `${HALF_INCH}px`

    editorRef.current?.focus()
    saveDocument()
  }

  const clearFormatting = () => {
    exec("removeFormat")
    exec("formatBlock", "<p>")
    saveDocument()
  }

  /**
   * Saves and downloads the document as a `.doc` file, which Microsoft Word
   * opens natively. This is the hand-off to the real desktop MS Word: the
   * student works in the page and takes the file into Word when needed.
   */
  const downloadForWord = () => {
    const editor = editorRef.current

    if (!editor) return

    saveDocument()

    const name = String(part?.name || "Document").replace(/[^\w-]+/g, "")
    // A minimal Word-compatible HTML wrapper: Word reads this as a .doc file.
    const html = [
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
      ' xmlns:w="urn:schemas-microsoft-com:office:word"><head>',
      '<meta charset="utf-8">',
      `<title>${name} - Part ${partLetter}</title>`,
      "<style>body{font-family:Arial,sans-serif;font-size:12pt;}</style>",
      "</head><body>",
      editor.innerHTML,
      "</body></html>",
    ].join("")

    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }))
    const link = document.createElement("a")

    link.href = url
    link.download = `${name}-Part${partLetter}.doc`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">

      {/* Ribbon */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2.5">

        <div className="flex items-center gap-2">
          <select
            aria-label="Font"
            defaultValue="Arial"
            onChange={(event) => { exec("fontName", event.target.value); saveDocument() }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-primary outline-none focus:border-brand"
          >
            {FONTS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>

          <select
            aria-label="Font size"
            defaultValue="12"
            onChange={(event) => { exec("fontSize", event.target.value); saveDocument() }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-primary outline-none focus:border-brand"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <Divider />

        <div className="flex items-center gap-1">
          <ToolButton onClick={() => { exec("bold"); saveDocument() }} className="font-bold">B</ToolButton>
          <ToolButton onClick={() => { exec("italic"); saveDocument() }} className="italic">I</ToolButton>
          <ToolButton onClick={() => { exec("underline"); saveDocument() }} className="underline">U</ToolButton>
        </div>

        <Divider />

        <div className="flex items-center gap-1">
          {ALIGNMENTS.map(({ command, label }) => (
            <ToolButton key={command} onClick={() => { exec(command); saveDocument() }}>
              {label}
            </ToolButton>
          ))}
        </div>

        <Divider />

        <div className="flex items-center gap-1">
          {LINE_SPACINGS.map(({ label, value }) => (
            <ToolButton key={label} onClick={() => applyLineSpacing(value)}>
              {label}
            </ToolButton>
          ))}
        </div>

        <Divider />

        <div className="flex items-center gap-1">
          <ToolButton onClick={toggleBox}>Box</ToolButton>
          <ToolButton onClick={toggleFirstLineIndent}>First line 0.5&quot;</ToolButton>
          <ToolButton onClick={() => nudgeIndent(-1)}>&minus; Indent</ToolButton>
          <ToolButton onClick={() => nudgeIndent(1)}>+ Indent</ToolButton>
        </div>

        <Divider />

        <div className="flex items-center gap-1">
          {HIGHLIGHTS.map(({ label, value }) => (
            <ToolButton key={label} onClick={() => { exec("hiliteColor", value); saveDocument() }}>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-sm border border-border"
                  style={{ backgroundColor: value === "transparent" ? "#fff" : value }}
                />
                {label}
              </span>
            </ToolButton>
          ))}
        </div>

        <Divider />

        <ToolButton onClick={clearFormatting}>Clear</ToolButton>

        <div className="ml-auto flex items-center gap-2">
          <ToolButton onClick={saveDocument}>Save</ToolButton>

          <ToolButton
            onClick={downloadForWord}
            className="border-brand bg-brand text-white hover:bg-brand-dark hover:text-white"
          >
            Download for MS Word
          </ToolButton>
        </div>
      </div>

      {/* A4 page */}
      <div className="flex-1 overflow-auto p-6">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={saveDocument}
          aria-label={`${part?.name || "Word"} document for Part ${partLetter} · ${questionLabel}`}
          className="mx-auto min-h-[900px] w-full max-w-[794px] bg-white px-20 py-24 text-sm text-black shadow-md outline-none"
          style={{ lineHeight: 1.15 }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-1.5 text-xs text-text-muted">
        <span>Part {partLetter} · {questionLabel}</span>

        <span className="tabular-nums">
          {counts.words} words · {counts.chars} characters
        </span>
      </div>

    </div>
  )
}

export default WordWorkspace
