/**
 * Practice-document links for the exam parts.
 *
 * Each part shows its document INLINE on the exam page. Real Microsoft Word is
 * rendered through Microsoft's Office Online (WOPI) viewer, which is the only
 * Office endpoint that permits framing: the regular `word.cloud.microsoft` web
 * apps send `Content-Security-Policy: frame-ancestors 'self' ...` and browsers
 * therefore refuse to display them inside an <iframe>.
 *
 * IMPORTANT: the document URL must be readable WITHOUT signing in - i.e. a
 * direct file URL or a link shared as "Anyone with the link". An
 * "open in the app" link (word.cloud.microsoft/open/onedrive/?docId=...) is
 * sign-in protected, so the viewer always answers "the document is not publicly
 * accessible" and the exam falls back to the built-in editor instead.
 *
 * The URLs can be overridden from the environment, so re-pointing a document
 * never requires editing source. Create frontend/.env with:
 *
 *   VITE_WORD_DOC_URL=https://<tenant>.sharepoint.com/... "Anyone" link
 */
const envWord = import.meta.env.VITE_WORD_DOC_URL
const envExcel = import.meta.env.VITE_EXCEL_DOC_URL
const envPowerpoint = import.meta.env.VITE_POWERPOINT_DOC_URL

export const EXAM_PART_LINKS = {
  word: {
    label: "MS Word",
    url:
      envWord ||
      "https://word.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21sd3cf91d81390485c8949d84d693b10ef&driveId=5177D6E04899183E",
  },
  excel: {
    label: "MS Excel",
    url:
      envExcel ||
      "https://excel.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21seb973216e1404544ae91bf487af55e7e&driveId=5177D6E04899183E",
  },
  powerpoint: {
    label: "MS PowerPoint",
    url:
      envPowerpoint ||
      "https://powerpoint.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21se326fb6636b84fb6a1d7e985289c17fe&driveId=5177D6E04899183E",
  },
}

/**
 * Microsoft's Office Online viewer: the one Office endpoint that allows
 * framing, so it is what the exam embeds to show a genuine Word / Excel /
 * PowerPoint document on the page.
 */
const OFFICE_VIEWER_BASE = "https://view.officeapps.live.com/op/embed.aspx"

/** Office app deep links are sign-in protected and cannot be framed. */
const isOfficeAppDeepLink = (url) =>
  /\/open\/(onedrive|sharepoint)\b/i.test(url) ||
  /^[a-z0-9-]+\.cloud\.microsoft\//i.test(url)

/**
 * True when the URL can be shown by the Office Online viewer: a direct file
 * URL, or a sharing link that resolves to a publicly readable document.
 */
export const isEmbeddableDocumentUrl = (url) => {
  const value = String(url || "").trim()

  return value.length > 0 && !isOfficeAppDeepLink(value)
}

/**
 * Builds the inline viewer URL for a practice document.
 *
 * The viewer detects the file type from the `src` document, so one endpoint
 * serves Word, Excel and PowerPoint. The ribbon stays editable
 * (`wdAllowInteractivity`) while the download and configurator buttons are
 * hidden, which keeps the practice documents from being copied out.
 *
 * Returns null for an app deep link or a missing URL, so the exam shows the
 * built-in editor instead of Microsoft's "file not found" error page.
 */
export const buildOfficeEmbedUrl = (url) => {
  if (!isEmbeddableDocumentUrl(url)) return null

  const params = new URLSearchParams({
    src: String(url).trim(),
    wdAllowInteractivity: "1",
    wdHideGridlines: "1",
    wdDownloadButton: "0",
    wdHideHeaders: "1",
    wdInConfigurator: "0",
    wdSmallScreen: "0",
  })

  return `${OFFICE_VIEWER_BASE}?${params.toString()}`
}

/** Requested display marks: Word 15, Excel 10, PowerPoint 10, Access 10, Email 5. */
export const EXAM_PART_MARKS = {
  word: 15,
  excel: 10,
  powerpoint: 10,
  access: 10,
  email: 5,
}

export const EXAM_TOTAL_MARKS = 50

/** Returns the configured link for a part name, if one exists. */
export const getExamPartLink = (name) => {
  const key = String(name || "").trim().toLowerCase()
  return EXAM_PART_LINKS[key] || null
}
