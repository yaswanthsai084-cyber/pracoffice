import { Link } from "react-router-dom"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import "./dashboard.css"

function Dashboard() {
  return (
    <div className="dashboard-page flex min-h-screen flex-col bg-page">

      <Header showLogout fullWidth />

      <main className="flex flex-1 flex-col">

        {/* Hero - fullscreen */}
        <section className="flex w-full flex-1">

          <div className="dashboard-hero relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-brand via-indigo-600 to-brand-dark p-8 text-white shadow-xl shadow-brand/25 sm:p-12 lg:p-16">

            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10 max-w-3xl">

              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ring-1 ring-white/25 backdrop-blur-sm">
                Online Exam · Proficiency in Office Automation
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Take the Online Exam
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                This site conducts the online exam for qualifying the test
                of proficiency in office automation — prove your skills in
                using the computer and assisted software for everyday office
                work.
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

      </main>

      <Footer fullWidth />

    </div>
  )
}

export default Dashboard