'use strict';

/**
 * Exam endpoints.
 *   GET  /api/exam        - the fixed paper (parts, questions, marks)
 *   POST /api/exam/submit - accept a finished attempt for evaluation
 */

const { getExamPaper } = require('../services/examPaper');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/exam - the paper the frontend renders. */
const getExam = asyncHandler(async (req, res) => {
  res.status(200).json({ exam: getExamPaper() });
});

/**
 * POST /api/exam/submit
 *
 * The frontend posts the candidate's answers and opens the results page as
 * soon as the submission is accepted. Automatic per-task marking is not
 * implemented yet, so each part is reported back as `pending` - exactly what
 * the Results page displays - together with the marks it carries.
 */
const submitExam = asyncHandler(async (req, res) => {
  const paper = getExamPaper();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const answers = body.parts && typeof body.parts === 'object' ? body.parts : {};

  const parts = paper.parts.map((part) => {
    const answered =
      Object.prototype.hasOwnProperty.call(answers, part.id) ||
      Object.prototype.hasOwnProperty.call(answers, part.key);

    return {
      id: part.id,
      key: part.key,
      name: part.name,
      totalMarks: part.totalMarks,
      obtainedMarks: 0,
      status: answered ? 'pending' : 'not-attempted',
    };
  });

  res.status(200).json({
    message: 'Exam submitted successfully. Evaluation is pending.',
    submittedAt: new Date().toISOString(),
    totalMarks: paper.totalMarks,
    obtainedMarks: 0,
    status: 'pending',
    parts,
  });
});

module.exports = { getExam, submitExam };
