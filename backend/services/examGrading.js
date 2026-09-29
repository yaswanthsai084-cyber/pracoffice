'use strict';

/**
 * Automatic marking for the written parts of the qualifying test.
 *
 * The paper (services/examPaper.js) tags every task with how it is graded:
 *
 *   grading: 'exact'     - the typed answer is compared (case/space/punctuation
 *                          insensitive) against one of the accepted answers.
 *   grading: 'keywords'  - each required keyword is looked for; the task earns
 *                          a proportional share of its marks.
 *   grading: 'manual'    - formatting and layout work done in Word, Excel,
 *                          PowerPoint or Access. The API cannot observe it, so
 *                          it is reported as awaiting an examiner instead of
 *                          being silently counted as zero.
 *
 * Keeping the manual tasks visible is deliberate: this exam is a 50 mark
 * practical, and pretending a formatting task scored 0 would misrepresent the
 * student's result. The response therefore reports both the auto-marked total
 * and how many marks are still pending manual review.
 */

/** Folds a typed answer into a comparable form. */
const normalize = (value) =>
  String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Also drops trailing sentence punctuation so "apego@nic.in." still matches. */
const normalizeExact = (value) => normalize(value).replace(/[.;:,]+$/, '').trim();

/** Rounds to 2 decimals so floating point shares never leak into the marks. */
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** True when the student typed something at all. */
const isAnswered = (value) => normalize(value).length > 0;

/**
 * Marks one task.
 *
 * @param {object} task  a paper task (`grading`, `marks`, and either `accepted`
 *                       or `keywords`)
 * @param {string} answer the student's typed answer
 * @returns {{id:string,label:string,marks:number,obtainedMarks:number,grading:string,status:string,feedback:string}}
 */
const markTask = (task, answer) => {
  const marks = Number(task.marks) || 0;
  const base = {
    id: task.id,
    label: task.label,
    marks,
    grading: task.grading || 'manual',
  };

  if (base.grading === 'manual') {
    return {
      ...base,
      obtainedMarks: 0,
      status: isAnswered(answer) ? 'manual-review' : 'not-attempted',
      feedback: 'Marked by an examiner.',
    };
  }

  if (!isAnswered(answer)) {
    return {
      ...base,
      obtainedMarks: 0,
      status: 'not-attempted',
      feedback: 'No answer given.',
    };
  }

  if (base.grading === 'exact') {
    const accepted = Array.isArray(task.accepted) ? task.accepted : [task.accepted];
    const typed = normalizeExact(answer);
    const hit = accepted.some((candidate) => normalizeExact(candidate) === typed);

    return {
      ...base,
      obtainedMarks: hit ? marks : 0,
      status: hit ? 'correct' : 'incorrect',
      feedback: hit ? 'Correct.' : 'Does not match the expected answer.',
    };
  }

  // keywords: proportional credit for every required keyword that is present.
  const keywords = Array.isArray(task.keywords) ? task.keywords : [];
  const typed = normalize(answer);
  const hit = keywords.filter((keyword) => typed.includes(normalize(keyword)));
  const share = keywords.length ? hit.length / keywords.length : 0;

  return {
    ...base,
    obtainedMarks: round(marks * share),
    status: share === 1 ? 'correct' : share > 0 ? 'partial' : 'incorrect',
    feedback:
      hit.length === 0
        ? 'None of the required points were found.'
        : `Found ${hit.length} of ${keywords.length} required points.`,
    matchedKeywords: hit,
  };
};

module.exports = { normalize, normalizeExact, markTask, round };
