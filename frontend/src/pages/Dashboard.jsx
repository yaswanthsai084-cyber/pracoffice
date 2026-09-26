import { Link } from "react-router-dom"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import "./dashboard.css"

function Dashboard() {
  const exam = {
    title: "Office Skills Practice Exam",
    parts: 5,
    durationMinutes: 30,
    totalMarks: 50,
  }

  const quickFacts = [
    `${exam.parts} simulated applications`,
    `${exam.durationMinutes} minute timer`,
    `${exam.totalMarks} total marks`,
    "Instant results",
  ]

  const software = [
    {
      name: "Word",
      part: "Part A",
      description: "Documents & formatting",
      interface: "Rich text editor",
      marks: 20,
      iconClasses: "bg-brand/10 text-brand",
    },
    {
      name: "Excel",
      part: "Part B",
      description: "Data, formulas & formatting",
      interface: "Spreadsheet grid",
      marks: 20,
      iconClasses: "bg-success/10 text-success",
    },
    {
      name: "PowerPoint",
      part: "Part C",
      description: "Slides & presentations",
      interface: "Slide editor",
      marks: 20,
      iconClasses: "bg-highlight/10 text-highlight",
    },
    {
      name: "Access",
      part: "Part D",
      description: "Tables, records & queries",
      interface: "Database tables",
      marks: 20,
      iconClasses: "bg-error/10 text-error",
    },
    {
      name: "Email",
      part: "Part E",
      description: "Inbox & email operations",
      interface: "Email client",
      marks: 20,
      iconClasses: "bg-accent/10 text-accent",
    },
  ]

  const steps = [
    {
      number: "01",
      title: "Perform",
      detail:
        "Complete practical tasks inside simulated Office applications that look and behave like the real software.",
    },
    {
      number: "02",
      title: "Submit",
      detail:
        "Complete all five parts and submit your work before the timer expires.",
    },
    {
      number: "03",
      title: "Review",
      detail:
        "Receive your score immediately with detailed feedback about the tasks you performed.",
    },
  ]

  const guidelines = [
    {
      title: "Timer-based exam",
      detail:
        "The exam runs against a countdown timer and auto-submits when the time expires.",
    },
    {
      title: "Single sitting",
      detail:
        "All five parts must be completed in one attempt — the exam cannot be resumed.",
    },
    {
      title: "Rule-based evaluation",
      detail:
        "Every part is evaluated against specific practical rules for that application.",
    },
    {
      title: "Detailed feedback",
      detail:
        "See exactly what was wrong and what was expected, element by element.",
    },
    {
      title: "Immediate results",
      detail: "Your score and feedback are displayed right after submission.",
    },
    {
      title: "No history",
      detail:
        "Results are shown once after submission and are never stored.",
    },
  ]

  return (
    <div className="dashboard-page flex min-h-screen flex-col bg-page">

      <Header showLogout />

      <main className="flex-1">

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">

          <div className="dashboard-hero relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-indigo-600 to-brand-dark p-8 text-white shadow-xl shadow-brand/25 sm:p-12">

            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10 max-w-3xl">

              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ring-1 ring-white/25 backdrop-blur-sm">
                Practical Skills Assessment
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Practice. Perform. Improve.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                Test how effectively you use everyday Microsoft Office
                applications by completing realistic practical tasks inside
                simulated interfaces.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">

                <Link
                  to="/exam"
                  className="dashboard-hero-btn rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-brand-dark shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50"
                >
                  Start Practice Exam
                </Link>

                <span className="text-sm text-white/75">
                  Single sitting · Auto-submits when the timer expires
                </span>

              </div>

              <div className="mt-8 flex flex-wrap gap-3">

                {quickFacts.map((fact) => (
                  <span
                    key={fact}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20 backdrop-blur-sm"
                  >
                    {fact}
                  </span>
                ))}

              </div>

            </div>

          </div>

        </section>

        {/* Exam overview */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">

            <div>

              <h2 className="text-2xl font-bold text-text-primary">
                Your Practice Exam
              </h2>

              <p className="mt-2 text-sm text-text-secondary">
                {exam.title} — complete practical tasks across{" "}
                {exam.parts} simulated applications.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <div className="rounded-xl bg-surface px-4 py-2.5 text-center ring-1 ring-border">
                <p className="text-lg font-bold text-text-primary">
                  {exam.parts}
                </p>

                <p className="text-xs text-text-muted">
                  Parts
                </p>
              </div>

              <div className="rounded-xl bg-surface px-4 py-2.5 text-center ring-1 ring-border">
                <p className="text-lg font-bold text-text-primary">
                  {exam.durationMinutes} min
                </p>

                <p className="text-xs text-text-muted">
                  Duration
                </p>
              </div>

              <div className="rounded-xl bg-surface px-4 py-2.5 text-center ring-1 ring-border">
                <p className="text-lg font-bold text-text-primary">
                  {exam.totalMarks}
                </p>

                <p className="text-xs text-text-muted">
                  Total marks
                </p>
              </div>

            </div>

          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {software.map((item) => (
              <div
                key={item.name}
                className="dashboard-card flex flex-col rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-border transition hover:-translate-y-1 hover:shadow-md"
              >

                <div className="flex items-start justify-between">

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold ${item.iconClasses}`}
                  >
                    {item.name.charAt(0)}
                  </div>

                  <span className="text-xs font-semibold text-text-muted">
                    {item.part}
                  </span>

                </div>

                <h3 className="mt-5 text-lg font-semibold text-text-primary">
                  {item.name}
                </h3>

                <p className="mt-2 text-sm text-text-secondary">
                  {item.description}
                </p>

                <p className="mt-1 text-xs font-medium text-text-muted">
                  Simulated {item.interface}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs">
                  <span className="font-medium text-text-secondary">
                    {item.marks} marks
                  </span>

                  <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    Part of assessment
                  </span>
                </div>

              </div>
            ))}

          </div>

        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">

          <div className="rounded-3xl bg-brand p-8 text-white shadow-xl shadow-brand/20 sm:p-10">

            <div className="flex flex-wrap items-center justify-between gap-4">

              <h2 className="text-2xl font-bold">
                How the assessment works
              </h2>

              <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ring-1 ring-white/25">
                3 simple steps
              </span>

            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">

              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-sm"
                >

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-sm font-bold ring-1 ring-white/20">
                    {step.number}
                  </div>

                  <p className="mt-4 text-lg font-semibold">
                    {step.title}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/80">
                    {step.detail}
                  </p>

                </div>
              ))}

            </div>

          </div>

        </section>

        {/* Exam rules & guidelines */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">

          <div className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border sm:p-10">

            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>

                <h2 className="text-2xl font-bold text-text-primary">
                  Exam rules &amp; guidelines
                </h2>

                <p className="mt-2 text-sm text-text-secondary">
                  Please read carefully before starting your assessment.
                </p>

              </div>

              <span className="rounded-full bg-highlight-light px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-highlight">
                Important
              </span>

            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">

              {guidelines.map((rule) => (
                <div
                  key={rule.title}
                  className="flex gap-4 rounded-2xl bg-page p-5 ring-1 ring-border"
                >

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-sm font-bold text-success">
                    ✓
                  </div>

                  <div>

                    <p className="font-semibold text-text-primary">
                      {rule.title}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      {rule.detail}
                    </p>

                  </div>

                </div>
              ))}

            </div>

          </div>

        </section>


      </main>

      <Footer />

    </div>
  )
}

export default Dashboard