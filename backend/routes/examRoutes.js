'use strict';

/**
 * Exam routes.
 *
 * The frontend loads the paper with GET /api/exam (see
 * frontend/src/services/examService.js) and posts the finished attempt to
 * POST /api/exam/submit. Both require a signed-in student: the exam pages are
 * guarded by <RequireAuth> and the JWT is sent as a bearer token.
 */

const express = require('express');

const examController = require('../controllers/examController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/exam - paper: title, duration, parts, questions and marks
router.get('/', examController.getExam);

// POST /api/exam/submit - accept the attempt and return the result summary
router.post('/submit', examController.submitExam);

module.exports = router;
