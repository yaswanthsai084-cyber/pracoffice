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

/**
 * Reads the body as text and only treats it as JSON when the response says so.
 *
 * This matters when the backend is down: the Vite proxy then answers with a
 * plain-text 500, and `response.json()` throws, leaving `payload` null. Without
 * this check the student only saw "Exam submission failed" and had no way to
 * tell a dead backend from a rejected answer.
 */
const readPayload = async (response) => {
  const raw = await response.text().catch(() => "")
  const contentType = response.headers.get("content-type") || ""

  return contentType.includes("application/json") && raw !== "" ? JSON.parse(raw) : null
}

/** Throws with the real reason: a dead backend is not a failed submission. */
const ensureOk = (response, payload) => {
  if (response.ok) return payload

  if (payload === null) {
    throw new Error(
      `The backend is not responding (HTTP ${response.status}). ` +
        `Start it with "npm run dev" in the backend folder, then submit again.`
    )
  }

  throw new Error(payload.message || `Request failed with status ${response.status}`)
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

/**
 * Loads the exam paper (backend first, bundled snapshot as fallback).
 *
 * The fallback is deliberately silent so the paper still renders when the API
 * is unreachable - but `submitExam` is not silent, so a submit against a dead
 * backend now reports the real reason instead of a generic failure.
 */
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

/** Submits the typed answers; the backend grades them and returns the result. */
export const submitExam = async (answers) => {
  const response = await fetch(`${API_BASE}/api/exam/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ answers }),
  })

  return ensureOk(response, await readPayload(response))
}

/**
 * Loads the signed-in student's most recent graded attempt.
 *
 * The results page reads the result from the API rather than from router state
 * so a page refresh, or opening /results directly, still shows the real marks.
 */
export const fetchResult = async () => {
  const response = await fetch(`${API_BASE}/api/exam/result`, {
    headers: getAuthHeaders(),
  })

  // No attempt yet: the page shows a "start the exam" state, not an error.
  if (response.status === 404) {
    return null
  }

  return (await ensureOk(response, await readPayload(response))).result ?? null
}
