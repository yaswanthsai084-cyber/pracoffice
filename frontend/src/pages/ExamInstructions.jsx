import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import { fetchExam } from "../services/examService"
import "./examInstructions.css"

/** Display names for the software used by each part (A Word ... E Email). */
const SOFTWARE_LABELS = {
  word: "MS Word",
  excel: "MS Excel",
  powerpoint: "MS PowerPoint",
  access: "MS Access",
  email: "Email (sending)",
}

/** Exam-wide rules shown before the paper is opened. */
const EXAM_RULES = [
  "This is a single sitting of 30 minutes. The countdown starts the moment you click Start Exam.",
  "The paper carries a total of 50 marks and is divided into five parts: A, B, C, D and E.",
  "Part A is MS Word, Part B is MS Excel, Part C is MS PowerPoint, Part D is MS Access and Part E is sending an email.",
  "Some parts contain more than one question — Part A and Part B each have two. Every question is shown on its own page.",
  "The question is placed at the top of the page and the matching software section (MS Word, MS Excel, ...) appears below it.",
  "Move between the parts with the part tabs, between the questions with the question tabs, and through the whole paper with the Previous / Next buttons.",
  "The exam is submitted automatically as soon as the timer reaches 00:00, so keep an eye on the countdown.",
  "You may also submit early from the last question once you have finished all the tasks.",
  "Do not refresh or close the exam window, and make sure your internet connection is stable.",
]

/** Number of questions in a part (older papers without `questions` count as one). */
const countQuestions = (part) =>
  Array.isArray(part.questions) && part.questions.length > 0
    ? part.questions.length
    : 1

/** Graded tasks across every question of a part. */
const countTasks = (part) =>
  (Array.isArray(part.questions) && part.questions.length > 0
    ? part.questions
    : [part]
  ).reduce((sum, question) => sum + (question.tasks?.length ?? 0), 0)

/** Minutes -> "30 minutes". */
const describeDuration = (minutes) => {
  const value = Number(minutes) || 0
  return `${value} ${value === 1 ? "minute" : "minutes"}`
}

function ExamInstructions() {
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [accepted, setAccepted] = useState(false)

  // Reuse the same paper the exam page loads (API first, bundled snapshot as
  // fallback) so the pattern, marks and duration always match the exam.
  useEffect(() => {
    let cancelled = false

    fetchExam().then((data) => {
      if (!cancelled) setExam(data)
    })

    return () => {
      cancelled = true
    }
  }, [])

  /** Opens the exam only after the declaration has been accepted. */
  const handleStart = () => {
    if (!accepted) return
    navigate("/exam")
  }

  if (!exam) {
    return (
      <div className="instructions-page flex min-h-screen flex-col bg-page">

        <Header fullWidth />

        <main className="flex flex-1 items-center justify-center px-4 py-16">

          <div className="text-center">

            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-light border-t-brand" />

            <p className="mt-4 text-sm font-medium text-text-secondary">
              Preparing the exam instructions...
            </p>

          </div>

        </main>

        <Footer fullWidth />

      </div>
    )
  }

  const durationMinutes =
    exam.duration ?? Math.round((exam.durationSeconds || 0) / 60)
  const totalMarks = exam.totalMarks ?? 0

  return (
    <div className="instructions-page flex min-h-screen flex-col bg-page">

      <Header showLogout fullWidth />

      <main className="flex-1">

        <section className="w-full px-4 py-10 sm:px-6 lg:px-8">

          {/* Heading */}
          <div className="text-center">

            <span className="inline-flex items-center rounded-full bg-brand-light px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand">
              Practical Assessment · {totalMarks} marks
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Exam Instructions
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              {exam.title} — read the exam pattern and the instructions below
              carefully before you begin.
            </p>

          </div>

          {/* Quick facts: marks, duration, number of parts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">

            <div className="instructions-fact rounded-2xl bg-surface p-5 text-center shadow-sm ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Total marks
              </p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{totalMarks}</p>
            </div>

            <div className="instructions-fact rounded-2xl bg-surface p-5 text-center shadow-sm ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Duration
              </p>
              <p className="mt-1 text-2xl font-bold text-text-primary">
                {describeDuration(durationMinutes)}
              </p>
            </div>

            <div className="instructions-fact rounded-2xl bg-surface p-5 text-center shadow-sm ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Parts
              </p>
              <p className="mt-1 text-2xl font-bold text-text-primary">
                {exam.parts.length} (A–E)
              </p>
            </div>

          </div>

          {/* Exam pattern */}
          <div className="mt-8 overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border">

            <div className="border-b border-border p-5">
              <h2 className="text-lg font-bold text-text-primary">Exam pattern</h2>

              <p className="mt-1 text-sm leading-6 text-text-secondary">
                {exam.description}
              </p>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="bg-page text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Part</th>
                    <th className="px-5 py-3 font-semibold">Software</th>
                    <th className="px-5 py-3 font-semibold">Questions</th>
                    <th className="px-5 py-3 font-semibold">Tasks</th>
                    <th className="px-5 py-3 text-right font-semibold">Marks</th>
                  </tr>
                </thead>

                <tbody>
                  {exam.parts.map((part, index) => (
                    <tr key={part.id || part.name} className="border-t border-border">
                      <td className="px-5 py-3 font-semibold text-text-primary">
                        Part {part.key || String.fromCharCode(65 + index)}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {SOFTWARE_LABELS[part.id] || part.name}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {countQuestions(part)}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {countTasks(part)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-text-primary">
                        {part.totalMarks}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t border-border bg-page">
                  <tr>
                    <td className="px-5 py-3 font-bold text-text-primary" colSpan={4}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-brand">
                      {totalMarks}
                    </td>
                  </tr>
                </tfoot>

              </table>

            </div>

          </div>

          {/* General instructions */}
          <div className="mt-8 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border sm:p-6">

            <h2 className="text-lg font-bold text-text-primary">General instructions</h2>

            <ol className="mt-4 space-y-3">
              {EXAM_RULES.map((rule, index) => (
                <li key={rule} className="flex gap-3 text-sm leading-6 text-text-secondary">
                  <span className="instructions-rule-number flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>

          </div>

          {/* Compulsory declaration + Start Exam */}
          <div className="mt-8 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border sm:p-6">

            <label className="instructions-accept flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="instructions-accepted"
                checked={accepted}
                onChange={() => setAccepted(true)}
                required
                className="instructions-radio mt-1 h-5 w-5 shrink-0"
              />
              <span className="text-sm leading-6 text-text-primary">
                I have read and understood all the instructions mentioned above
                and I am ready to start the exam.
              </span>
            </label>

            <button
              type="button"
              onClick={handleStart}
              disabled={!accepted}
              className="instructions-start-btn mt-5 w-full rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              Start Exam
            </button>

            {!accepted && (
              <p className="mt-3 text-center text-xs font-medium text-text-muted">
                Select the radio button above to enable the Start Exam button.
              </p>
            )}

            <p className="mt-4 text-center text-sm">
              <Link
                to="/dashboard"
                className="font-semibold text-brand transition hover:text-brand-dark"
              >
                ← Back to Dashboard
              </Link>
            </p>

          </div>

        </section>

      </main>

      <Footer fullWidth />

    </div>
  )
}

export default ExamInstructions
