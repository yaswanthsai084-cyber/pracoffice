import { useEffect, useState } from "react"
import Header from "../common/Header"
import Footer from "../common/Footer"
import { Link } from "react-router-dom"
import { fetchResult } from "../../services/examService"
import "./results.css"

/** Per-task status -> the badge colour and label shown next to a task. */
const STATUS_STYLES = {
  correct: "bg-success/10 text-success",
  partial: "bg-highlight/10 text-highlight",
  incorrect: "bg-error/10 text-error",
  "manual-review": "bg-text-muted/10 text-text-secondary",
  "not-attempted": "bg-text-muted/10 text-text-muted",
}

const STATUS_LABELS = {
  correct: "Correct",
  partial: "Partly correct",
  incorrect: "Incorrect",
  "manual-review": "Awaiting examiner",
  "not-attempted": "Not attempted",
}

function Results() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // The result is read from the API, not from router state, so refreshing the
  // page (or opening /results directly) still shows the graded marks.
  useEffect(() => {
    let cancelled = false

    fetchResult()
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="results-page flex min-h-screen flex-col bg-page">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-light border-t-brand" />
            <p className="mt-4 text-sm font-medium text-text-secondary">
              Loading your result...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-page flex min-h-screen flex-col bg-page">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <p className="rounded-xl bg-error/10 px-5 py-4 text-sm font-medium text-error">
            {error}
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="results-page flex min-h-screen flex-col bg-page">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary">No result yet</h1>
            <p className="mt-2 text-sm text-text-secondary">
              You have not submitted an exam yet. Attempt the paper to see your marks.
            </p>
            <Link
              to="/exam"
              className="mt-6 inline-flex rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 hover:bg-brand-dark"
            >
              Start the exam
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const {
    parts = [],
    obtainedMarks,
    totalMarks,
    autoObtainedMarks,
    autoTotalMarks,
    manualMarks,
  } = result

  return (
    <div className="results-page flex min-h-screen flex-col bg-page">

      <Header />

      <main className="flex-1">

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">

          {/* Result summary */}
          <div className="rounded-3xl bg-surface p-8 text-center shadow-sm ring-1 ring-border sm:p-10">

            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              Assessment Complete
            </p>

            <h1 className="mt-3 text-3xl font-bold text-text-primary sm:text-4xl">
              Your Practice Results
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">
              Your written answers were marked automatically. The practical tasks
              (formatting, charts and slides) are marked separately by an examiner.
            </p>

            <div className="results-score mx-auto mt-8 flex h-32 w-32 flex-col items-center justify-center rounded-full bg-brand-light">

              <span className="text-3xl font-bold text-brand">
                {obtainedMarks}
              </span>

              <span className="text-xs text-text-secondary">
                out of {totalMarks} marks
              </span>

            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">

              <span className="rounded-full bg-brand-light px-4 py-2 font-semibold text-brand">
                Written answers: {autoObtainedMarks} / {autoTotalMarks}
              </span>

              <span className="rounded-full bg-text-muted/10 px-4 py-2 font-semibold text-text-secondary">
                Awaiting examiner: {manualMarks} marks
              </span>

            </div>

          </div>

          {/* Part results */}
          <div className="mt-10">

            <h2 className="text-2xl font-bold text-text-primary">
              Performance by Part
            </h2>

            <div className="mt-5 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border">

              {parts.map((part) => (
                <div
                  key={part.id}
                  className="border-b border-border p-5 last:border-b-0"
                >

                  <div className="flex items-center justify-between gap-4">

                    <div>
                      <h3 className="font-semibold text-text-primary">
                        Part {part.key} · {part.name}
                      </h3>

                      <p className="mt-1 text-sm text-text-secondary">
                        {part.manualMarks > 0
                          ? `Marked ${part.autoObtainedMarks} of ${part.autoTotalMarks} written · ${part.manualMarks} marks awaiting examiner`
                          : `Marked ${part.obtainedMarks} of ${part.totalMarks}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-text-primary">
                        {part.obtainedMarks} / {part.totalMarks}
                      </p>
                    </div>

                  </div>

                  {/* Per-task detail, straight from the backend breakdown */}
                  <ul className="mt-4 space-y-2">
                    {(part.questions || []).flatMap((question) =>
                      (question.tasks || []).map((task) => (
                        <li
                          key={task.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-page px-4 py-2.5"
                        >
                          <span className="text-sm text-text-secondary">
                            {task.label}
                          </span>

                          <span className="flex items-center gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                STATUS_STYLES[task.status] ||
                                STATUS_STYLES["not-attempted"]
                              }`}
                            >
                              {STATUS_LABELS[task.status] || task.status}
                            </span>

                            <span className="w-16 text-right text-sm font-semibold text-text-primary">
                              {task.obtainedMarks} / {task.marks}
                            </span>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>

                </div>
              ))}

            </div>

          </div>

          {/* Back */}
          <div className="mt-8 text-center">

            <Link
              to="/dashboard"
              className="results-btn inline-flex rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 hover:bg-brand-dark"
            >
              Back to Dashboard
            </Link>

          </div>

        </section>

      </main>

      <Footer />

    </div>
  )
}

export default Results