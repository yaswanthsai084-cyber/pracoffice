import { useCallback, useEffect, useRef, useState } from "react"
import { EDITOR_FRAME_CLASS } from "./editorFrame"

/**
 * Embeds the real ONLYOFFICE editor for a Word / Excel / PowerPoint part.
 *
 * How it works:
 *   1. Ask the backend for a signed editor config (`/api/office/config/:part`).
 *      The backend answers `available: false` when the integration is off.
 *   2. Load ONLYOFFICE's own `api.js` from the document server.
 *   3. Hand the config to `new DocsAPI.DocEditor(...)`, which renders the editor.
 *
 * ONLYOFFICE saves through its own callback URL, so this component never uploads
 * anything itself - it only has to create and destroy the editor. The editor is
 * destroyed on unmount (switching exam tabs) so the student neither loses work
 * nor leaves an orphaned editing session.
 *
 * Every failure path calls `onUnavailable`, so the exam page falls back to the
 * built-in editor instead of showing a broken frame mid-exam.
 */

/** api.js is loaded once per page and shared by every part. */
let apiScriptPromise = null

const loadOnlyOfficeApi = (apiUrl) => {
  if (window.DocsAPI) return Promise.resolve(window.DocsAPI)
  if (apiScriptPromise) return apiScriptPromise

  apiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")

    script.src = apiUrl
    script.async = true
    script.onload = () =>
      window.DocsAPI
        ? resolve(window.DocsAPI)
        : reject(new Error("The document server loaded but exposed no DocsAPI."))
    script.onerror = () => {
      // A failed load must not be cached, or a retry after the container comes
      // up would keep using the rejected promise and never recover.
      apiScriptPromise = null
      reject(new Error(`Could not load ${apiUrl}.`))
    }

    document.head.appendChild(script)
  })

  return apiScriptPromise
}

/** Messages shown while each editor loads. */
const LOADING_COPY = {
  word: "Loading the Word editor…",
  excel: "Loading the Excel editor…",
  powerpoint: "Loading the PowerPoint editor…",
}

function OnlyOfficeEditor({ partId, partName, onUnavailable }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  // Tracks whether the document itself loaded. An `onError` before that point
  // means the student is looking at an error/preview frame rather than an
  // editor, which is exactly the failure the fallback exists for.
  const readyRef = useRef(false)
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  /** Tears the editor down so nothing is left running behind the tab. */
  const destroyEditor = useCallback(() => {
    const editor = editorRef.current

    if (!editor) return

    try {
      editor.destroyEditor()
    } catch {
      // The editor may already be gone; nothing to clean up either way.
    }

    editorRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    readyRef.current = false

    const start = async () => {
      try {
        const token = localStorage.getItem("token")
        const response = await fetch(`/api/office/config/${partId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        const payload = await response.json().catch(() => null)

        if (cancelled) return

        // The backend answers 200 with `available: false` when the document
        // server is not configured, so this is a normal outcome, not an error.
        if (!response.ok || !payload?.available) {
          setStatus("unavailable")
          onUnavailable?.(payload?.reason || "unavailable")
          return
        }

        const DocsAPI = await loadOnlyOfficeApi(payload.apiUrl)

        if (cancelled) return

        if (!containerRef.current) {
          setStatus("unavailable")
          onUnavailable?.("no-container")
          return
        }

        // `events` are client-side callbacks: they must NOT be part of the
        // signed `config.token` the backend produced, so they are attached
        // here at construction time, not inside the signed payload.
        const editor = new DocsAPI.DocEditor(containerRef.current.id, {
          ...payload.config,
          events: {
            onError: (event) => {
              const message =
                event?.data?.message ||
                (typeof event?.data === "string" ? event.data : null) ||
                "The document editor reported an error."
              console.error("[onlyoffice] editor error:", event?.data || event)
              // A failure before the document loads means the student is
              // looking at an error/preview frame, not an editor. Hand off to
              // the fallback (with retry for Excel / PowerPoint) instead of
              // leaving that frame on screen. Errors after load are left
              // alone: destroying a working session mid-exam would be worse.
              if (!readyRef.current && !cancelled) {
                setStatus("unavailable")
                setError(message)
                onUnavailable?.("editor-error")
              }
            },
            onDocumentReady: () => {
              readyRef.current = true
              console.log(`[onlyoffice] ${partId} document ready`)
            },
          },
        })

        editorRef.current = editor
        setStatus("ready")
      } catch (problem) {
        if (cancelled) return

        setStatus("unavailable")
        setError(problem.message || "The document editor could not be started.")
        onUnavailable?.(problem.message || "error")
      }
    }

    start()

    return () => {
      cancelled = true
      destroyEditor()
    }
  }, [partId, destroyEditor, onUnavailable])

  return (
    <div className="relative flex flex-1 flex-col min-h-0 bg-white">
      <div
        id={`onlyoffice-${partId}`}
        ref={containerRef}
        className={EDITOR_FRAME_CLASS}
      />

      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-light border-t-brand" />

          <p className="text-sm font-semibold text-text-secondary">
            {LOADING_COPY[partId] || `Loading the ${partName || "document"} editor…`}
          </p>

          <p className="max-w-sm px-6 text-center text-xs leading-5 text-text-muted">
            The document editor runs in a separate container. The first load can
            take a few seconds.
          </p>
        </div>
      )}

      {status === "unavailable" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-sm font-semibold text-text-secondary">
            The {partName || "document"} editor is unavailable.
          </p>

          <p className="max-w-md text-xs leading-5 text-text-muted">
            {error || "Continuing in the built-in editor instead."}
          </p>
        </div>
      )}
    </div>
  )
}

export default OnlyOfficeEditor
