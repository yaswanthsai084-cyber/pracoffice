function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-md">
            P
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              PracOffice
            </h1>

            <p className="text-xs text-slate-500">
              Practical Office Skills
            </p>
          </div>
        </div>

        {/* Header right side */}
        <div className="hidden items-center gap-4 sm:flex">
          <span className="text-sm text-slate-500">
            Practice. Perform. Improve.
          </span>
        </div>

      </div>
    </header>
  )
}

export default Header;