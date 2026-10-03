import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Header from "../common/Header"
import Footer from "../common/Footer"
import OfficeViewer from "./OfficeViewer"
import { EDITOR_PANEL_CLASS } from "./editorFrame"
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

/** Part letter fallback: 0 -> A, 1 -> B, ... */
const partLetter = (part, index) => part?.key || String.fromCharCode(65 + index)

/**
 * Every part carries one or more questions and each question is shown on its
 * own page. Older papers (or the backend) may supply only `instructions`, so
 * a single synthetic question is derived in that case.
 */
const resolveQuestions = (part) => {
  if (!part) return []

  if (Array.isArray(part.questions) && part.questions.length > 0) {
    return part.questions
  }

  return [
    {
      id: `${part.id || part.name}-q1`,
      label: "Question 1",
      title: part.name || "",
      marks: part.totalMarks ?? 0,
      instructions: part.instructions ?? "",
      tasks: part.tasks ?? [],
    },
  ]
}

function Exam() {
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // Typed answers keyed by task id ({ "e2-subject": "Republic Day ..." }).
  // Kept outside `exam` so typing never re-creates the paper object.
  const [answers, setAnswers] = useState({})

  // Load the exam paper from the backend; fall back to the bundled snapshot
  // when the API is unreachable or the student is not authenticated yet.
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
  const activeQuestions = resolveQuestions(activePart)
  const safeQuestionIndex = Math.min(
    activeQuestionIndex,
    Math.max(0, activeQuestions.length - 1)
  )
  const activeQuestion = activeQuestions[safeQuestionIndex] || null
  const activeLink = activePart?.link

  // Only the tasks the backend can mark get an input; formatting/layout work
  // is graded by an examiner, so it is shown as a checklist without a box.
  const autoTasks = (activeQuestion?.tasks || []).filter(
    (task) => task.grading && task.grading !== "manual"
  )

  // Flat list of every question in the paper (A-Q1, A-Q2, B-Q1, ...) used by
  // the Previous / Next buttons so they walk question by question.
  const steps = exam
    ? exam.parts.flatMap((part, partIndex) =>
        resolveQuestions(part).map((question, questionIndex) => ({
          partIndex,
          questionIndex,
        }))
      )
    : []

  const foundStep = steps.findIndex(
    (step) =>
      step.partIndex === activeIndex && step.questionIndex === safeQuestionIndex
  )
  const currentStep = foundStep < 0 ? 0 : foundStep
  const totalQuestions = steps.length

  /** Opens a part at its first question. */
  const openPart = (index) => {
    setActiveIndex(index)
    setActiveQuestionIndex(0)
  }

  /** Jumps to any question in the paper (Previous / Next navigation). */
  const goToStep = (index) => {
    const step = steps[index]
    if (!step) return

    setActiveIndex(step.partIndex)
    setActiveQuestionIndex(step.questionIndex)
  }

  /** Records what the student typed for a task. */
  const setAnswer = (taskId, value) => {
    setAnswers((current) => ({ ...current, [taskId]: value }))
  }

  /** Submits the exam and moves to the results page. */
  const handleSubmit = async () => {
    if (submitting) return

    setSubmitting(true)

    try {
      // Empty strings are dropped so an untouched box is never graded as an
      // attempt, and the backend still receives every answered task.
      const payload = Object.fromEntries(
        Object.entries(answers).filter(([, value]) => value.trim() !== "")
      )
      await submitExam(payload)
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
  if (!exam || !activePart || !activeQuestion) {
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
                onClick={() => openPart(index)}
                className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-semibold transition ${
                  activeIndex === index
                    ? "exam-tab-active border-brand text-brand"
                    : "border-transparent text-text-secondary hover:text-brand"
                }`}
              >
                Part {partLetter(part, index)} · {part.name}
              </button>
            ))}

          </div>

        </div>

        {/* Question navigation: only for parts with more than one question */}
        {activeQuestions.length > 1 && (
          <div className="border-b border-border bg-page">

            <div className="flex w-full flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">

              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Questions in Part {partLetter(activePart, activeIndex)}
              </span>

              {activeQuestions.map((question, index) => (
                <button
                  key={question.id || index}
                  onClick={() => setActiveQuestionIndex(index)}
                  title={question.title}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    index === safeQuestionIndex
                      ? "border-brand bg-brand-light text-brand"
                      : "border-border bg-surface text-text-secondary hover:text-brand"
                  }`}
                >
                  {question.label}
                </button>
              ))}

            </div>

          </div>
        )}

        {/* One question per page, with the matching software section below it */}
        <section className="w-full px-4 py-8 sm:px-6 lg:px-8">

          {/* Question shown on this page */}
          <div className="rounded-2xl bg-surface shadow-sm ring-1 ring-border">

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Part {partLetter(activePart, activeIndex)} · {activePart.name}
                </p>

                <h2 className="mt-1 text-xl font-bold text-text-primary">
                  {activeQuestion.label}
                  {activeQuestion.title ? `: ${activeQuestion.title}` : ""}
                </h2>
              </div>

              <span className="rounded-full bg-brand-light px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand">
                {activeQuestion.marks} marks
              </span>

            </div>

            <div className="p-5">
              {(activeQuestion.instructions || "").split("\n").map((line, index) => (
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

            {/* Typed answers for the tasks the backend can mark automatically.
                Tasks without an input are practical work graded by an examiner. */}
            <div className="space-y-4 border-t border-border p-5">

              {autoTasks.length > 0 && autoTasks.map((task) => (
                <div key={task.id}>

                  <label
                    htmlFor={`answer-${task.id}`}
                    className="flex items-start justify-between gap-3 text-sm font-semibold text-text-primary"
                  >
                    <span>{task.label}</span>
                    <span className="shrink-0 rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand">
                      {task.marks} {task.marks === 1 ? "mark" : "marks"}
                    </span>
                  </label>

                  <textarea
                    id={`answer-${task.id}`}
                    rows={task.id === "a10-letter-content" || task.id === "e3-body" ? 5 : 2}
                    value={answers[task.id] || ""}
                    onChange={(event) => setAnswer(task.id, event.target.value)}
                    placeholder={task.placeholder || "Type your answer here…"}
                    className="mt-2 w-full resize-y rounded-xl border border-border bg-page px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />

                </div>
              ))}

              {(activeQuestion.tasks || []).length > autoTasks.length && (
                <p className="text-xs leading-5 text-text-muted">
                  The remaining{" "}
                  {(activeQuestion.tasks || []).length - autoTasks.length} item(s) in this
                  question are practical tasks (formatting, charts, slides) marked by
                  an examiner.
                </p>
              )}

            </div>

          </div>

          {/* The real MS Office application for this part, shown in the page */}
          <div className={`mt-6 ${EDITOR_PANEL_CLASS}`}>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-page px-4 py-3">

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-error/70" />
                <span className="h-3 w-3 rounded-full bg-highlight/70" />
                <span className="h-3 w-3 rounded-full bg-success/70" />
              </div>

              <p className="text-xs font-semibold text-text-secondary">
                {activePart.name}
                {activeLink ? ` · ${activeLink.label}` : ""}
              </p>

              <span className="text-xs text-text-muted">
                Part {partLetter(activePart, activeIndex)} · {activeQuestion.label}
              </span>

            </div>

            <OfficeViewer
              part={activePart}
              partLetter={partLetter(activePart, activeIndex)}
              questionLabel={activeQuestion.label}
            />

          </div>

          {/* Navigation across every question in the paper */}
          <div className="mt-6 flex items-center justify-between gap-4">

            <button
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 0}
              className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-secondary transition enabled:hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>

            <p className="text-center text-sm font-medium text-text-muted">
              Question {currentStep + 1} of {totalQuestions}
            </p>

            {currentStep < totalQuestions - 1 ? (
              <button
                onClick={() => goToStep(currentStep + 1)}
                className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
              >
                Next Question →
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
