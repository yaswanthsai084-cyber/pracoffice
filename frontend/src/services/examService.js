import FALLBACK_EXAM from "./examData"
import { EXAM_PART_MARKS, EXAM_TOTAL_MARKS, getExamPartLink } from "./examLinks"

/**
 * Exam API client (PLAN.md endpoints).
 *
 * GET  /api/exam       -> exam paper with per-part questions
 * POST /api/exam/submit-> evaluate + immediate results
 *
 * The Vite dev server proxies /api to the backend, and a bundled
 * snapshot of the paper is used when the API is unreachable so the
 * exam frame always renders the part questions.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ""

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")

  return token ? { Authorization: `Bearer ${token}` } : {}
}

const configureExam = (data) => ({
  ...data,
  duration: 30,
  durationSeconds: 30 * 60,
  totalMarks: EXAM_TOTAL_MARKS,
  parts: (data.parts || []).map((part) => ({
    ...part,
    totalMarks: EXAM_PART_MARKS[String(part.name || "").toLowerCase()] ?? part.totalMarks,
    link: getExamPartLink(part.name),
  })),
})

/** Loads the exam paper (backend first, bundled snapshot as fallback). */
export const fetchExam = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/exam`, {
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Exam request failed with status ${response.status}`)
    }

    const payload = await response.json()

    if (!payload?.exam?.parts?.length) {
      throw new Error("Exam response did not include any parts")
    }

    return configureExam(payload.exam)
  } catch (error) {
    console.warn("Using the bundled exam paper fallback:", error.message)

    return configureExam(FALLBACK_EXAM)
  }
}

/** Submits the exam for evaluation (immediate results, nothing stored). */
export const submitExam = async (submission) => {
  const response = await fetch(`${API_BASE}/api/exam/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(submission),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.message || "Exam submission failed")
  }

  return payload
}
