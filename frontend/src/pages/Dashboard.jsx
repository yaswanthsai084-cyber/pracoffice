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

             

            </div>

          </div>

        </section>

        {/* Exam overview */}
        


      </main>

      <Footer />

    </div>
  )
}

export default Dashboard