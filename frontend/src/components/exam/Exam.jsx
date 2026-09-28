import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Header from "../common/Header"
import Footer from "../common/Footer"
import { fetchExam, submitExam } from "../../services/examService"
import "./exam.css"

/** Formats seconds as h:mm:ss / mm:ss for the countdown badge. */
const formatTime = (totalSeconds) => {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  const pad = (value) => String(value).padStart(2, "0")

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainder)}`
    : `${pad(minutes)}:${pad(remainder)}`
}

function Exam() {
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Load the exam paper from the backend; fall back to the bundled
  // snapshot when the API is unreachable or not authenticated yet.
  useEffect(() => {
    let cancelled = false

    fetchExam().then((data) => {
      if (cancelled) return

      setExam(data)
      setSecondsLeft(data.durationSeconds || data.duration * 60)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Countdown timer: ticks once per second while the paper is open.
  useEffect(() => {
    if (!exam) return undefined

    const timer = setInterval(() => {
      setSecondsLeft((current) =>
        current === null ? current : Math.max(0, current - 1)
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [exam])

  const activePart = exam ? exam.parts[activeIndex] : null
  const activeLink = activePart?.link

  /** Submits the exam and moves to the results page. */
  const handleSubmit = async () => {
    if (submitting) return

    setSubmitting(true)

    try {
      await submitExam({ parts: {} })
      navigate("/results")
    } catch (error) {
      window.alert(error.message || "Could not submit the exam right now.")
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-submit when the timer reaches zero (PLAN.md: timer-based exam).
  useEffect(() => {
    if (exam && secondsLeft === 0) {
      handleSubmit()
    }
  }, [exam, secondsLeft])

  // Loading state while the exam paper is being fetched.
  if (!exam) {
    return (
      <div className="flex min-h-screen flex-col bg-page">

        <Header fullWidth />

        <main className="flex flex-1 items-center justify-center px-4 py-16">

          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-light border-t-brand" />

            <p className="mt-4 text-sm font-medium text-text-secondary">
              Loading the exam paper...
            </p>
          </div>

        </main>

        <Footer fullWidth />

      </div>
    )
  }

  return (
    <div className="exam-page flex min-h-screen flex-col bg-page">

      <Header fullWidth />

      <main className="flex-1">

        {/* Exam header */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">

          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                Practical Assessment · {exam.totalMarks} marks
              </p>

              <h1 className="mt-1 text-xl font-bold text-text-primary">
                {exam.title}
              </h1>
            </div>

            {/* Timer */}
            <div
              className={`exam-timer rounded-xl border px-5 py-3 text-center ${
                secondsLeft !== null && secondsLeft <= 300
                  ? "border-error/40 bg-error/10"
                  : "border-border bg-page"
              }`}
            >
              <p className="text-xs text-text-muted">
                Time remaining
              </p>

              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  secondsLeft !== null && secondsLeft <= 300
                    ? "text-error"
                    : "text-text-primary"
                }`}
              >
                {formatTime(secondsLeft ?? 0)}
              </p>
            </div>

          </div>

        </div>

        {/* Part navigation */}
        <div className="border-b border-border bg-surface">

          <div className="flex w-full overflow-x-auto px-4 sm:px-6 lg:px-8">

            {exam.parts.map((part, index) => (
              <button
                key={part.id || part.name}
                onClick={() => setActiveIndex(index)}
                className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-semibold transition ${
                  activeIndex === index
                    ? "exam-tab-active border-brand text-brand"
                    : "border-transparent text-text-secondary hover:text-brand"
                }`}
              >
                Part {part.key || String.fromCharCode(65 + index)} · {part.name}
              </button>
            ))}

          </div>

        </div>

        {/* Workspace */}
        <section className="w-full px-4 py-8 sm:px-6 lg:px-8">

          <div className="grid gap-6 lg:grid-cols-[380px,1fr]">

            {/* Question panel */}
            <aside className="flex flex-col gap-5">

              <div className="rounded-2xl bg-surface shadow-sm ring-1 ring-border">

                <div className="border-b border-border p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Part {activePart.key || String.fromCharCode(65 + activeIndex)} · {activePart.totalMarks} marks
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-text-primary">
                    {activePart.name} tasks
                  </h2>
                </div>

                <div className="p-5">
                  {activePart.instructions.split("\n").map((line, index) => (
                    <p
                      key={index}
                      className={
                        index === 0
                          ? "text-sm font-medium text-text-primary"
                          : "mt-2 text-sm leading-6 text-text-secondary"
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>

              </div>

            </aside>

            {/* Simulated application frame */}
            <div className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border">

              <div className="flex items-center justify-between border-b border-border bg-page px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-error/70" />
                  <span className="h-3 w-3 rounded-full bg-highlight/70" />
                  <span className="h-3 w-3 rounded-full bg-success/70" />
                </div>

                <p className="text-xs font-semibold text-text-secondary">
                  Simulated {activePart.name} application
                </p>

                <span className="text-xs text-text-muted">
                  Part {activePart.key || String.fromCharCode(65 + activeIndex)}
                </span>
              </div>

              <div className="flex flex-1 items-center justify-center p-8">

                <div className="max-w-md text-center">

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-xl font-bold text-brand">
                    {activePart.name.charAt(0)}
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-text-primary">
                    {activePart.name} workspace
                  </h3>

                  {activeLink ? (
                    <a
                      href={activeLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand-dark"
                    >
                      {activeLink.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <p className="mt-5 text-sm font-medium text-text-secondary">
                      Continue completing the tasks listed in the instructions panel.
                    </p>
                  )}

                </div>

              </div>

            </div>

          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">

            <button
              onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
              disabled={activeIndex === 0}
              className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-secondary transition enabled:hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>

            <p className="text-sm font-medium text-text-muted">
              Part {activeIndex + 1} of {exam.parts.length}
            </p>

            {activeIndex < exam.parts.length - 1 ? (
              <button
                onClick={() =>
                  setActiveIndex((current) =>
                    Math.min(exam.parts.length - 1, current + 1)
                  )
                }
                className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
              >
                Next Part →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl bg-success px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-success/20 transition hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            )}

          </div>

        </section>

      </main>

      <Footer fullWidth />

    </div>
  )
}

export default Exam