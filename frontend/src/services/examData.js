/**
 * Frontend snapshot of the fixed exam paper. It mirrors the backend's
 * `services/examPaper.js` (title, duration, per-part instructions and
 * graded tasks) and is used as a fallback when GET /api/exam is
 * unreachable or the student is not authenticated yet, so the exam
 * frame always has the part questions to render.
 */

const FALLBACK_EXAM = {
  title: "PracOffice Practice Exam",
  description:
    "Simulated Office practice exam covering Word, Excel, PowerPoint, Access and Email. Complete all five parts within the time limit.",
  duration: 30,
  durationSeconds: 30 * 60,
  totalMarks: 50,
  partCount: 5,
  parts: [
    {
      id: "word",
      key: "A",
      name: "Word",
      totalMarks: 15,
      partOrder: 1,
      instructions: [
        "Create a short document in the simulated Word interface:",
        '1. Give the document the title "Practice Office Skills" - bold, 16 pt, centred.',
        '2. Add an introduction paragraph starting with "Welcome" in Times New Roman 12 pt.',
        '3. Make the phrase "practical examination" bold wherever it appears.',
        "4. Insert a bulleted list with 3 items.",
        "5. Add a 4 row x 3 column table with the headers Item, Quantity, Price.",
        "6. Set the page orientation to landscape (at least 6 paragraphs in total).",
      ].join("\n"),
      tasks: [
        { id: "a1-title", label: "Document title is bold, 16 pt and centred", description: "Type the title exactly as given and apply bold + centre alignment.", marks: 4, penalty: false },
        { id: "a2-intro", label: "Introduction paragraph uses Times New Roman 12 pt", marks: 3, penalty: false },
        { id: "a3-bold-phrase", label: '"practical examination" is bold', marks: 3, penalty: false },
        { id: "a4-bullets", label: "A bulleted list with 3 items", marks: 3, penalty: false },
        { id: "a5-table", label: "Table with 4 rows, 3 columns and the correct headers", marks: 4, penalty: false },
        { id: "a6-landscape", label: "Landscape page orientation with at least 6 paragraphs", marks: 3, penalty: false },
        { id: "a7-no-placeholder", label: "Placeholder text must be removed", description: 'Remove any leftover "Lorem ipsum" filler text.', marks: 0, penalty: true },
      ],
    },
    {
      id: "excel",
      key: "B",
      name: "Excel",
      totalMarks: 10,
      partOrder: 2,
      instructions: [
        'Build a worksheet named "Results":',
        "1. A1 = Item, B1 = Amount (both bold).",
        "2. Fill A2:B5 with: Pens 250, Books 1200, Paper 800, Folders 500.",
        "3. In B6 use the formula =SUM(B2:B5).",
        "4. Format B6 bold, yellow fill, number format 0.00.",
        '5. Insert a column chart titled "Amount by Item".',
      ].join("\n"),
      tasks: [
        { id: "b1-sheet", label: 'Worksheet is named "Results"', marks: 2, penalty: false },
        { id: "b2-headers", label: 'Headers "Item" / "Amount" are entered and bold', marks: 3, penalty: false },
        { id: "b3-data", label: "All eight data cells are filled in and total 2750", marks: 4, penalty: false },
        { id: "b4-total-formula", label: "B6 contains the formula =SUM(B2:B5)", description: "Type the formula instead of the calculated number.", marks: 4, penalty: false },
        { id: "b5-total-format", label: "B6 is bold with a yellow fill and 0.00 number format", marks: 3, penalty: false },
        { id: "b6-chart", label: 'Column chart titled "Amount by Item"', marks: 4, penalty: false },
      ],
    },
    {
      id: "powerpoint",
      key: "C",
      name: "PowerPoint",
      totalMarks: 10,
      partOrder: 3,
      instructions: [
        "Create a three slide presentation:",
        '1. Slide 1 uses the Title layout with the title "Practice Office Skills".',
        '2. Slide 2 has a text box containing "Agenda", bold 28 pt, a fade transition and speaker notes.',
        '3. Slide 3 contains the image "office.png" at least 200 px wide.',
        '4. Apply the "Office" theme to the presentation.',
      ].join("\n"),
      tasks: [
        { id: "c1-title-slide", label: "Slide 1 is a title slide with the correct title", marks: 3, penalty: false },
        { id: "c2-slide-count", label: "At least 3 slides", marks: 2, penalty: false },
        { id: "c3-agenda", label: '"Agenda" text box is bold 28 pt', marks: 4, penalty: false },
        { id: "c4-image", label: "office.png image is at least 200 px wide", marks: 4, penalty: false },
        { id: "c5-notes-transition", label: "Slide 2 has speaker notes and a fade transition", marks: 4, penalty: false },
        { id: "c6-theme", label: 'The "Office" theme is applied', marks: 3, penalty: false },
      ],
    },
    {
      id: "access",
      key: "D",
      name: "Access",
      totalMarks: 10,
      partOrder: 4,
      instructions: [
        "Create a simple database:",
        '1. Table "Students" with 5 fields and at least 3 records.',
        "2. StudentID is the primary key and uses AutoNumber.",
        "3. Email is Short Text, at least 50 characters, required.",
        "4. Record with StudentID 1 has FirstName = Ali and City = Muscat.",
        "5. At least 2 students are from Muscat.",
        '6. Query "TopStudents" selects FirstName and City from Students where City = "Muscat".',
      ].join("\n"),
      tasks: [
        { id: "d1-table", label: 'Table "Students" has 5 fields and at least 3 records', marks: 4, penalty: false },
        { id: "d2-primary-key", label: "StudentID is an AutoNumber primary key", marks: 4, penalty: false },
        { id: "d3-email-field", label: "Email is Short Text (>= 50), required", marks: 3, penalty: false },
        { id: "d4-first-record", label: "Record with StudentID 1 has FirstName = Ali and City = Muscat", marks: 3, penalty: false },
        { id: "d5-muscat-count", label: "At least 2 students from Muscat", marks: 3, penalty: false },
        { id: "d6-query", label: 'Query "TopStudents" returns FirstName and City for Muscat', marks: 3, penalty: false },
      ],
    },
    {
      id: "email",
      key: "E",
      name: "Email",
      totalMarks: 5,
      partOrder: 5,
      instructions: [
        "Use the simulated email client:",
        '1. Send a message to manager@office.com with subject "Weekly Report" and attach report.xlsx.',
        '2. The body must start with "Dear Manager".',
        '3. Flag the message whose subject contains "Invoice" as important with High importance.',
        "4. The Inbox must contain at least 3 messages.",
      ].join("\n"),
      tasks: [
        { id: "e1-send-report", label: 'Send "Weekly Report" to manager@office.com with one attachment', marks: 6, penalty: false },
        { id: "e2-attachment", label: "report.xlsx is attached", marks: 5, penalty: false },
        { id: "e3-greeting", label: 'Body starts with "Dear Manager"', marks: 4, penalty: false },
        { id: "e4-invoice-flagged", label: "The invoice message is flagged with High importance", marks: 3, penalty: false },
        { id: "e5-inbox", label: "Inbox holds at least 3 messages", marks: 2, penalty: false },
      ],
    },
  ],
}

export default FALLBACK_EXAM
