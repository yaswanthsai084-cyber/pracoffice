import { useCallback, useEffect, useState } from "react"
import WordWorkspace from "./WordWorkspace"
import OnlyOfficeEditor from "./OnlyOfficeEditor"
import { buildOfficeEmbedUrl, isEmbeddableDocumentUrl } from "../../services/examLinks"
import { EDITOR_FRAME_CLASS } from "./editorFrame"

/**
 * Parts whose exam task the built-in editor can actually fulfill. `WordWorkspace`
 * is a Word-styled rich-text surface: it can stand in for a Word passage, but it
 * has no spreadsheet grid and no slide canvas, so routing Excel / PowerPoint to
 * it shows something that reads as "preview, no edit option". Those parts get an
 * explicit retry panel instead (see below).
 */
const LOCAL_EDITORS = ["word"]

/** The exam part name that maps to each editor part. */
const OFFICE_PART_IDS = { word: "word", excel: "excel", powerpoint: "powerpoint" }

/** Shown for parts that have neither a document nor an editor (Access, Email). */
function WorkspacePlaceholder({ name }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-xl font-bold text-brand">
        {(name || "?").charAt(0)}
      </div>

      <h3 className="text-lg font-bold text-text-primary">{name} workspace</h3>

      <p className="max-w-md text-sm font-medium text-text-secondary">
        Continue completing this question in the application provided.
      </p>
    </div>
  )
}

/**
 * Shown for Excel / PowerPoint when ONLYOFFICE Docs failed.
 *
 * Reloading the real spreadsheet / slide editor is the only action that can
 * produce an editable grid or canvas, so this is a retry panel, not a
 * different renderer. Retrying clears the latch below, which remounts
 * `OnlyOfficeEditor`; that fetches a fresh signed config and rebuilds the
 * editor, so a transient document-server hiccup recovers in one click.
 */
function EditorUnavailablePanel({ partName, reason, onRetry }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-xl font-bold text-brand">
        {(partName || "?").charAt(0)}
      </div>

      <h3 className="text-lg font-bold text-text-primary">{partName} editor unavailable</h3>

      <p className="max-w-md text-sm font-medium text-text-secondary">
        The editable {partName} workspace could not be started
        {reason ? ` (${reason})` : ""}. Your work is safe — nothing was lost.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
      >
        Retry the {partName} editor
      </button>
    </div>
  )
}

/**
 * Shows the document for an exam part directly on the exam page.
 *
 * Renderers are tried in order:
 *
 *   1. **ONLYOFFICE Docs** (`OnlyOfficeEditor`) - the real Word / Excel /
 *      PowerPoint editor. It needs the document server, so the backend may
 *      report it as unavailable.
 *   2. **Microsoft's Office Online viewer** - a web view, but only for a
 *      publicly shared document. A sign-in protected "open in the app" deep
 *      link always shows Microsoft's "not publicly accessible" error, so the
 *      next fallback is used instead.
 *   3. **A working surface that matches the task** - the built-in `WordWorkspace`
 *      for Word only (a rich-text surface cannot do spreadsheet or slide work),
 *      or an explicit retry panel for Excel / PowerPoint that reloads the real
 *      editor instead of showing a preview-like fallback.
 *
 * The fallbacks matter: an exam must never break because a container is down,
 * and it must never silently swap the spreadsheet or slide editor for a Word
 * page either.
 */
function OfficeViewer({ part, partLetter, questionLabel, onOnlyOfficeUnavailable }) {
  const documentUrl = part?.link?.url
  const embedUrl = buildOfficeEmbedUrl(documentUrl)

  const [officeUnavailable, setOfficeUnavailable] = useState(false)
  const [unavailableReason, setUnavailableReason] = useState("")
  // Bumped on every retry so the editor is destroyed and rebuilt rather than
  // reusing a frame that already showed an error/preview.
  const [retryCount, setRetryCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  // The parent is told ONLYOFFICE is down exactly once per part, through a
  // stable callback, so Rules-of-Hooks linting and react-refresh stay quiet.
  const handleOnlyOfficeUnavailable = useCallback(
    (reason) => {
      setUnavailableReason(String(reason || "unavailable"))
      setOfficeUnavailable(true)
      onOnlyOfficeUnavailable?.(reason)
    },
    [onOnlyOfficeUnavailable]
  )

  // Clears the latch so `OnlyOfficeEditor` remounts and tries again. Excel and
  // PowerPoint have no other editable surface, so this retry is their way back
  // to a working editor.
  const handleRetryOffice = useCallback(() => {
    setUnavailableReason("")
    setOfficeUnavailable(false)
    setRetryCount((count) => count + 1)
  }, [])

  const partName = String(part?.name || "").trim().toLowerCase()
  const officePartId = OFFICE_PART_IDS[partName] || null
  // Once ONLYOFFICE has reported itself unavailable for this part, the
  // component stays on the cheaper renderers rather than retrying on every
  // re-render.
  const canUseOnlyOffice = Boolean(officePartId) && !officeUnavailable

  // A new document link restarts the loading veil.
  useEffect(() => {
    if (!embedUrl) return undefined

    setLoaded(false)
    setTimedOut(false)

    // Office for the web is heavy on a cold start. The veil is lifted either
    // way, so a slow viewer never hides a document that did render.
    const timer = setTimeout(() => setTimedOut(true), 12000)

    return () => clearTimeout(timer)
  }, [embedUrl])

  // Reset the "unavailable" latch when the student moves to another part.
  useEffect(() => {
    setOfficeUnavailable(false)
    setUnavailableReason("")
    setRetryCount(0)
  }, [partName])

  // ONLYOFFICE handles its own loading and error states.
  // The remount counter is part of the identity: retrying has to rebuild the
  // editor even when nothing else changed.
  if (canUseOnlyOffice) {
    return (
      <OnlyOfficeEditor
        key={`${partName}-${retryCount}`}
        partId={officePartId}
        partName={part?.name}
        onUnavailable={handleOnlyOfficeUnavailable}
      />
    )
  }

  // No document configured for this part (MS Access / Email).
  if (!documentUrl) return <WorkspacePlaceholder name={part?.name} />

  const hasEditor = LOCAL_EDITORS.includes(partName)

  // Excel / PowerPoint with ONLYOFFICE down: do NOT show the Word surface. It
  // has no grid and no slides, which reads as "preview, no edit option". Say
  // so plainly and offer the real editor again instead.
  if (officeUnavailable && officePartId && !hasEditor) {
    return (
      <EditorUnavailablePanel
        partName={part?.name}
        reason={unavailableReason}
        onRetry={handleRetryOffice}
      />
    )
  }

  // A sign-in protected link: use the built-in editor rather than an error page.
  if (!isEmbeddableDocumentUrl(documentUrl)) {
    return hasEditor ? (
      <WordWorkspace
        part={part}
        partLetter={partLetter}
        questionLabel={questionLabel}
      />
    ) : (
      <WorkspacePlaceholder name={part?.name} />
    )
  }

  return (
    <div className="relative flex flex-1 flex-col min-h-0 bg-white">

      <iframe
        key={embedUrl}
        src={embedUrl}
        title={`${part.name} — Part ${partLetter} · ${questionLabel}`}
        onLoad={() => setLoaded(true)}
        allow="clipboard-read; clipboard-write"
        // Full editing ribbon: the student really types in Word/Excel here.
        allowFullScreen
        className={`${EDITOR_FRAME_CLASS} border-0`}
      />

      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface">

          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-light border-t-brand" />

          <p className="text-sm font-semibold text-text-secondary">
            Loading {part.link.label}…
          </p>

          <p className="max-w-sm px-6 text-center text-xs leading-5 text-text-muted">
            {timedOut
              ? "This is taking longer than usual. If nothing appears, open the document in a new tab below."
              : "The first load signs in to Microsoft Office for the web and can take a few seconds."}
          </p>

        </div>
      )}

      {/* Escape hatch for a slow, blocked or signed-out viewer. */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-10 p-3">
        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-sm backdrop-blur transition hover:bg-page hover:text-brand ${
            loaded ? "opacity-0 focus:opacity-100" : ""
          }`}
        >
          Open in {part.name}
          <span aria-hidden="true">↗</span>
        </a>
      </div>

    </div>
  )
}

export default OfficeViewer
