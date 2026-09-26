import { Component, Suspense, lazy, useEffect, useRef, useState } from "react"

/**
 * Optional Unlayer rich-text body editor.
 *
 * react-email-editor (MIT) injects https://editor.unlayer.com/embed.js at
 * runtime, so it only works with internet access and is not bundled. It is
 * therefore strictly opt-in: if the script cannot load (locked-down exam lab,
 * offline machine, ad blocker) this component reports the failure and the
 * caller keeps the plain-textarea composer, so Part E can never be blocked
 * by a third-party CDN being unreachable.
 */
const EmailEditor = lazy(() => import("react-email-editor"))

const SCRIPT_PROBE_URL = "https://editor.unlayer.com/embed.js"
const READY_TIMEOUT_MS = 12000

/** Keeps a CDN crash from taking the whole exam page down with it. */
class EditorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate() {
    if (this.state.failed && this.props.onFailed) {
      this.props.onFailed()
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function RichBodyEditor({ onHtml, onClose }) {
  const editorRef = useRef(null)
  const [status, setStatus] = useState("loading")

  // Treat a silent script failure as a failure instead of an infinite spinner.
  useEffect(() => {
    if (status !== "loading") return undefined

    const timer = setTimeout(() => setStatus("failed"), READY_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [status])

  // Fail fast when the CDN host is unreachable rather than waiting it out.
  useEffect(() => {
    let cancelled = false

    const probe = new Image()

    probe.onerror = () => {
      if (!cancelled) setStatus("failed")
    }

    probe.src = `${SCRIPT_PROBE_URL}?probe=${Date.now()}`

    return () => {
      cancelled = true
    }
  }, [])

  const handleReady = (unlayer) => {
    setStatus("ready")

    // Start from a clean single-column canvas sized to the composer.
    unlayer?.loadDesign?.({
      counting: "word",
      rows: [
        {
          style: { backgroundColor: null, padding: { top: 12, bottom: 12 } },
          verticalAlign: "top",
          id: "exam-body-row",
          children: [
            {
              style: {
                padding: { top: 0, bottom: 0, left: 18, right: 18 },
                backgroundColor: null,
              },
              children: [
                {
                  type: "richtext",
                  style: { textAlign: "left" },
                  data: { text: "<p>Dear Manager,</p>" },
                },
              ],
            },
          ],
        },
      ],
    })
  }

  const handleInsert = () => {
    const unlayer = editorRef.current?.editor

    if (!unlayer) {
      onClose()

      return
    }

    unlayer.exportHtml(({ html }) => {
      // Unlayer wraps content in a full document; keep only the body so the
      // stored message stays readable in the plain-text reading pane too.
      const inner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)

      onHtml((inner ? inner[1] : html).trim())
      onClose()
    })
  }

  if (status === "failed") {
    return null
  }

  return (
    <div className="email-rich">
      <div className="email-rich-bar">
        <span className="text-xs font-semibold text-text-secondary">
          Rich body editor
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsert}
            disabled={status !== "ready"}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {status === "loading" ? "Loading..." : "Use this body"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-page"
          >
            Cancel
          </button>
        </div>
      </div>

      <EditorBoundary onFailed={() => setStatus("failed")}>
        <Suspense fallback={<div className="email-rich-loading">Loading editor...</div>}>
          <EmailEditor
            ref={editorRef}
            onReady={handleReady}
            style={{ minHeight: 380 }}
            options={{
              displayMode: "email",
              tools: {
                count: false,
                social: false,
                maps: false,
                form: false,
                countdown: false,
                menu: false,
                video: false,
              },
              appearance: { showLockIndicator: false },
            }}
          />
        </Suspense>
      </EditorBoundary>
    </div>
  )
}
