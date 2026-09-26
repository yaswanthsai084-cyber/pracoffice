import Header from "../common/Header"
import Footer from "../common/Footer"
import { Link } from "react-router-dom"
import "./result.css"

function Results() {
  const results = [
    {
      part: "Word",
      score: 0,
      total: 0,
      status: "Pending",
    },
    {
      part: "Excel",
      score: 0,
      total: 0,
      status: "Pending",
    },
    {
      part: "PowerPoint",
      score: 0,
      total: 0,
      status: "Pending",
    },
    {
      part: "Access",
      score: 0,
      total: 0,
      status: "Pending",
    },
    {
      part: "Email",
      score: 0,
      total: 0,
      status: "Pending",
    },
  ]

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
              Your performance has been evaluated based on the practical
              tasks completed during the assessment.
            </p>

            <div className="results-score mx-auto mt-8 flex h-32 w-32 flex-col items-center justify-center rounded-full bg-brand-light">

              <span className="text-3xl font-bold text-brand">
                --
              </span>

              <span className="text-xs text-text-secondary">
                Total Score
              </span>

            </div>

          </div>

          {/* Part results */}
          <div className="mt-10">

            <h2 className="text-2xl font-bold text-text-primary">
              Performance by Part
            </h2>

            <div className="mt-5 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border">

              {results.map((result) => (
                <div
                  key={result.part}
                  className="flex items-center justify-between border-b border-border p-5 last:border-b-0"
                >

                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {result.part}
                    </h3>

                    <p className="mt-1 text-sm text-text-secondary">
                      {result.status}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-text-primary">
                      {result.score} / {result.total}
                    </p>
                  </div>

                </div>
              ))}

            </div>

          </div>

          {/* Feedback */}
          <div className="mt-10 rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-border">

            <h2 className="text-xl font-bold text-text-primary">
              Detailed Feedback
            </h2>

            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Detailed per-element feedback will appear here after the
              evaluation engine returns the assessment results.
            </p>

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