/**
 * External practice-document links configured for the exam parts.
 * These open in a new tab; PracOffice does not embed or claim ownership
 * of the linked documents.
 */
export const EXAM_PART_LINKS = {
  word: {
    label: "Open Word document",
    url: "https://word.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21sd3cf91d81390485c8949d84d693b10ef&driveId=5177D6E04899183E",
  },
  excel: {
    label: "Open Excel workbook",
    url: "https://excel.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21seb973216e1404544ae91bf487af55e7e&driveId=5177D6E04899183E",
  },
  powerpoint: {
    label: "Open PowerPoint presentation",
    url: "https://powerpoint.cloud.microsoft/open/onedrive/?docId=5177D6E04899183E%21se326fb6636b84fb6a1d7e985289c17fe&driveId=5177D6E04899183E",
  },
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
