'use strict';

/**
 * Exam endpoints.
 *   GET  /api/exam        - the fixed paper (parts, questions, marks)
 *   POST /api/exam/submit - grade a finished attempt and store the result
 *   GET  /api/exam/result - the signed-in student's most recent result
 */

const { getExamPaper } = require('../services/examPaper');
const { markTask, round } = require('../services/examGrading');
const { ExamAttempt } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/apiError');

/** GET /api/exam - the paper the frontend renders. */
const getExam = asyncHandler(async (req, res) => {
  res.status(200).json({ exam: getExamPaper() });
});

/**
 * Reads the typed answers out of the request body.
 *
 * Accepts `{ answers: { "<taskId>": "text" } }` and also the older
 * `{ parts: { <partId>: { answers: {...} } } }` shape so an older client keeps
 * working. Anything non-string is ignored rather than trusted.
 */
const readAnswers = (body) => {
  const collect = (source) => {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') answers[key] = value;
    }
  };

  const answers = {};
  collect(body.answers);

  if (body.parts && typeof body.parts === 'object') {
    for (const part of Object.values(body.parts)) {
      if (part && typeof part === 'object') collect(part.answers);
    }
  }

  return answers;
};

/**
 * POST /api/exam/submit
 *
 * Marks every task in the paper against the student's typed answers, stores
 * the attempt and returns the full breakdown the results dashboard renders.
 *
 * Tasks the API can judge are marked automatically. Formatting and layout work
 * (font sizes, alignment, charts, slides…) is invisible to the API, so it is
 * reported as `manual-review` and counted in `manualMarks` rather than being
 * silently added to the score as a zero.
 */
const submitExam = asyncHandler(async (req, res) => {
  const paper = getExamPaper();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const answers = readAnswers(body);

  let autoObtained = 0;
  let autoTotal = 0;
  let manualMarks = 0;

  const parts = paper.parts.map((part) => {
    let partObtained = 0;
    let partAutoTotal = 0;
    let partAutoObtained = 0;
    let partManual = 0;

    const questions = part.questions.map((question) => {
      const tasks = question.tasks.map((task) => {
        const marked = markTask(task, answers[task.id]);

        partObtained += marked.obtainedMarks;

        if (marked.grading === 'manual') {
          partManual += marked.marks;
        } else {
          partAutoTotal += marked.marks;
          partAutoObtained += marked.obtainedMarks;
        }

        return marked;
      });

      const obtainedMarks = round(
        tasks.reduce((total, task) => total + task.obtainedMarks, 0)
      );

      return {
        id: question.id,
        label: question.label,
        title: question.title,
        totalMarks: question.marks,
        obtainedMarks,
        status: obtainedMarks > 0 ? 'marked' : 'not-obtained',
        tasks,
      };
    });

    autoObtained += partAutoObtained;
    autoTotal += partAutoTotal;
    manualMarks += partManual;

    return {
      id: part.id,
      key: part.key,
      name: part.name,
      totalMarks: part.totalMarks,
      obtainedMarks: round(partObtained),
      autoObtainedMarks: round(partAutoObtained),
      autoTotalMarks: partAutoTotal,
      manualMarks: partManual,
      // Every part still carries practical work, so none is ever "not attempted".
      status: partManual > 0 ? 'partially-marked' : 'marked',
      questions,
    };
  });

  const obtainedMarks = round(parts.reduce((total, part) => total + part.obtainedMarks, 0));
  const percentage = autoTotal > 0 ? round((autoObtained / autoTotal) * 100) : 0;

  const result = {
    submittedAt: new Date().toISOString(),
    totalMarks: paper.totalMarks,
    obtainedMarks,
    autoObtainedMarks: round(autoObtained),
    autoTotalMarks: autoTotal,
    manualMarks,
    percentage,
    // The headline status only claims "marked" once nothing is left to review.
    status: manualMarks > 0 ? 'pending-review' : 'marked',
    parts,
  };

  await ExamAttempt.create({
    user_id: req.user.id,
    total_marks: paper.totalMarks,
    auto_obtained_marks: round(autoObtained),
    auto_total_marks: autoTotal,
    manual_marks: manualMarks,
    answers,
    result,
  });

  res.status(200).json({
    message:
      manualMarks > 0
        ? 'Exam submitted successfully. Your written answers have been marked automatically; the practical tasks are awaiting an examiner.'
        : 'Exam submitted successfully. All answers have been marked.',
    ...result,
  });
});

/** GET /api/exam/result - the signed-in student's most recent graded attempt. */
const getResult = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({
    where: { user_id: req.user.id },
    order: [['id', 'DESC']],
  });

  if (!attempt) {
    throw AppError.notFound('You have not submitted an exam yet.');
  }

  res.status(200).json({ result: attempt.result });
});

module.exports = { getExam, submitExam, getResult };
