import { useState } from "react"
import { Link } from "react-router-dom"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import OnlyOfficeEditor from "../components/exam/OnlyOfficeEditor"
import { EDITOR_PANEL_CLASS } from "../components/exam/editorFrame"

const PARTS = [
  { id: "word", label: "Word", hint: "documentType: word · fileType: docx" },
  { id: "excel", label: "Excel", hint: "documentType: cell · fileType: xlsx" },
  { id: "powerpoint", label: "PowerPoint", hint: "documentType: slide · fileType: pptx" },
]

/**
 * Standalone ONLYOFFICE playground.
 *
 * Same backend as the exam (`GET /api/office/config/:partId` ->
 * `DocsAPI.DocEditor`), but outside the exam timer so the Word / Excel /
 * PowerPoint editors can be opened and verified directly:
 *
 *   /office-test  (requires login, like /exam)
 */
function OfficeTest() {
  const [activePart, setActivePart] = useState("word")
  const [fallbackNote, setFallbackNote] = useState("")
  const [retryCount, setRetryCount] = useState(0)

  const active = PARTS.find((part) => part.id === activePart) || PARTS[0]

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header showLogout fullWidth />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">ONLYOFFICE editors</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Live check of the Document Server at <code>http://localhost:8080</code> via the
              backend at <code>/api/office</code>. {active.hint}
            </p>
          </div>

          <Link
            to="/dashboard"
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-page"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {PARTS.map((part) => (
            <button
              key={part.id}
              type="button"
              onClick={() => {
                setFallbackNote("")
                setActivePart(part.id)
              }}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                activePart === part.id
                  ? "bg-brand text-white shadow-lg shadow-brand/20"
                  : "border border-border bg-surface text-text-secondary hover:bg-page"
              }`}
            >
              {part.label}
            </button>
          ))}
        </div>

        {fallbackNote && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm font-medium text-text-secondary">
            <p className="min-w-0 flex-1">{fallbackNote}</p>
            <button
              type="button"
              onClick={() => {
                setFallbackNote("")
                setRetryCount((count) => count + 1)
              }}
              className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Retry editor
            </button>
          </div>
        )}

        <div className={`mt-4 flex-1 ${EDITOR_PANEL_CLASS}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-page px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-error/70" />
              <span className="h-3 w-3 rounded-full bg-highlight/70" />
              <span className="h-3 w-3 rounded-full bg-success/70" />
            </div>
            <p className="text-xs font-semibold text-text-secondary">
              {active.label} · served by ONLYOFFICE Docs
            </p>
            <span className="text-xs text-text-muted">/office-test · {active.id}</span>
          </div>

          <OnlyOfficeEditor
            key={`${activePart}-${retryCount}`}
            partId={activePart}
            partName={active.label}
            onUnavailable={(reason) => {
              setFallbackNote(
                `The ${active.label} editor reported unavailable (${reason}). ` +
                  "Check that the backend has OFFICE_ENABLED=true and the document server answers http://localhost:8080/healthcheck."
              )
            }}
          />
        </div>
      </main>

      <Footer fullWidth />
    </div>
  )
}

export default OfficeTest
