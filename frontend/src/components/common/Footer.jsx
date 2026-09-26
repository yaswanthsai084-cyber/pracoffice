import "./footer.css"

function Footer({ fullWidth = false }) {
  return (
    <footer className="site-footer border-t">
      <div className={`${fullWidth ? "w-full" : "mx-auto max-w-7xl"} footer-text flex flex-col items-center justify-between gap-3 px-6 py-6 text-sm sm:flex-row lg:px-8`}>

        <p>
          © 2026 Proficiency in Office Automation. All rights reserved.
        </p>

        <p>
          Online exam for qualifying the proficiency test
        </p>

      </div>
    </footer>
  )
}

export default Footer;