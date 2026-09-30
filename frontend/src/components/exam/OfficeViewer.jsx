import { useEffect, useState } from "react"
import WordWorkspace from "./WordWorkspace"
import { buildOfficeEmbedUrl, isEmbeddableDocumentUrl } from "../../services/examLinks"

/** Parts that get a built-in editor when real Office cannot be embedded. */
const LOCAL_EDITORS = ["word", "excel", "powerpoint"]

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
 * Shows the document for an exam part directly on the exam page.
 *
 * Real Microsoft Word / Excel / PowerPoint is preferred, via Microsoft's Office
 * Online viewer. When the configured link is an "open in the app" deep link it
 * is sign-in protected, so the viewer would only ever show Microsoft's "file not
 * found / not publicly accessible" error. In that case the part's editor is
 * rendered instead, so the student is never left with a broken frame.
 *
 * The viewer is cross-origin, so a refusal to frame it is invisible to us: the
 * parent page only receives a `load` event. A loading veil is therefore lifted
 * on the first event and after a grace period, and a discreet "open in Word"
 * link is kept as an escape hatch.
 */
function OfficeViewer({ part, partLetter, questionLabel }) {
  const documentUrl = part?.link?.url
  const embedUrl = buildOfficeEmbedUrl(documentUrl)

  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!embedUrl) return undefined

    setLoaded(false)
    setTimedOut(false)

    // Office for the web is heavy on a cold start. The veil is lifted either
    // way, so a slow viewer never hides a document that did render.
    const timer = setTimeout(() => setTimedOut(true), 12000)

    return () => clearTimeout(timer)
  }, [embedUrl])

  // No document configured for this part (MS Access / Email).
  if (!documentUrl) return <WorkspacePlaceholder name={part?.name} />

  const hasEditor = LOCAL_EDITORS.includes(
    String(part?.name || "").trim().toLowerCase()
  )

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
    <div className="relative flex-1 bg-white">

      <iframe
        key={embedUrl}
        src={embedUrl}
        title={`${part.name} — Part ${partLetter} · ${questionLabel}`}
        onLoad={() => setLoaded(true)}
        allow="clipboard-read; clipboard-write"
        // Full editing ribbon: the student really types in Word/Excel here.
        allowFullScreen
        className="h-full min-h-[520px] w-full border-0"
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
