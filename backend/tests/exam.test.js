'use strict';

/**
 * Integration tests for the exam endpoints.
 *   GET  /api/exam
 *   POST /api/exam/submit
 *
 * The paper payload is what frontend/src/services/examService.js renders, so
 * the assertions cover the structure the exam pages depend on.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { api, registerUser, stopTestServer } = require('./support/serverHarness');

test.after(async () => {
  await stopTestServer();
});

/** Registers a student and returns their bearer token. */
const signedInStudent = async () => {
  const registration = await registerUser();
  assert.equal(
    registration.status,
    201,
    `registration should succeed, got: ${JSON.stringify(registration.body)}`
  );
  return registration.body.token;
};

test('GET /api/exam requires a signed-in student', async () => {
  const response = await api('/api/exam');

  assert.equal(response.status, 401);
  assert.match(response.body.message, /log in/i);
});

test('GET /api/exam returns the paper with every part, question and mark', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam', { token });

  assert.equal(response.status, 200, JSON.stringify(response.body));

  const { exam } = response.body;
  assert.match(exam.title, /^Qualifying Test/);
  assert.equal(exam.duration, 30);
  assert.equal(exam.durationSeconds, 1800);
  assert.equal(exam.totalMarks, 50);
  assert.equal(exam.parts.length, 5);
  assert.deepEqual(
    exam.parts.map((part) => part.key),
    ['A', 'B', 'C', 'D', 'E']
  );

  // 7 question pages in total: Parts A and B carry two questions each.
  assert.deepEqual(
    exam.parts.map((part) => part.questions.length),
    [2, 2, 1, 1, 1]
  );
  assert.equal(exam.parts.flatMap((part) => part.questions).length, 7);

  // Question marks add up to the part total, and the parts to the paper total.
  for (const part of exam.parts) {
    const sum = part.questions.reduce((total, question) => total + question.marks, 0);
    assert.equal(
      sum,
      part.totalMarks,
      `Part ${part.key} question marks should add up to ${part.totalMarks}`
    );
  }
  assert.equal(exam.parts.reduce((total, part) => total + part.totalMarks, 0), 50);
});

test('every question exposes the fields the exam page renders', async () => {
  const token = await signedInStudent();
  const { body } = await api('/api/exam', { token });

  for (const part of body.exam.parts) {
    for (const question of part.questions) {
      assert.ok(question.id, `Part ${part.key} question needs an id`);
      assert.ok(question.label, `Part ${part.key} question needs a label`);
      assert.equal(typeof question.marks, 'number');
      assert.ok(question.instructions.length > 0, `${question.id} needs instructions`);
      assert.ok(question.tasks.length > 0, `${question.id} needs its graded tasks`);
      for (const task of question.tasks) {
        assert.ok(task.id && task.label);
        assert.equal(typeof task.marks, 'number');
      }
    }
  }

  // The questions carry the official paper content.
  assert.match(body.exam.parts[0].questions[0].instructions, /The Habit of Reading/);
  assert.match(body.exam.parts[0].questions[1].instructions, /GOVERNMENT OF ANDHRA PRADESH/);
  assert.match(body.exam.parts[1].questions[0].instructions, /electricity production/);
  assert.match(body.exam.parts[4].questions[0].instructions, /apego@nic\.in/);
});

test('POST /api/exam/submit requires a signed-in student', async () => {
  const response = await api('/api/exam/submit', { method: 'POST', body: { parts: {} } });

  assert.equal(response.status, 401);
});

/** Flattens the response breakdown into `taskId -> task` for easy assertions. */
const tasksById = (body) =>
  Object.fromEntries(
    body.parts
      .flatMap((part) => part.questions)
      .flatMap((question) => question.tasks)
      .map((task) => [task.id, task])
  );

test('POST /api/exam/submit marks an exact-match answer', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e2-subject': 'Republic Day Function Arrangements' } },
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const tasks = tasksById(response.body);
  assert.equal(tasks['e2-subject'].status, 'correct');
  assert.equal(tasks['e2-subject'].obtainedMarks, 1);
});

test('exact marking ignores case, extra spaces and trailing punctuation', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e2-subject': '  republic DAY function   arrangements.  ' } },
  });

  const tasks = tasksById(response.body);
  assert.equal(tasks['e2-subject'].status, 'correct');
  assert.equal(tasks['e2-subject'].obtainedMarks, 1);
});

test('a wrong exact answer scores zero and is reported as incorrect', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e2-subject': 'Holiday Notice' } },
  });

  const tasks = tasksById(response.body);
  assert.equal(tasks['e2-subject'].status, 'incorrect');
  assert.equal(tasks['e2-subject'].obtainedMarks, 0);
});

test('keyword marking awards proportional marks', async () => {
  const token = await signedInStudent();

  // All six keywords of d1-table (4 marks) are present.
  const full = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: {
      answers: {
        'd1-table': 'CREATE TABLE Electricity (Year int, Thermal int, Hydro int, Solar int)',
      },
    },
  });
  assert.equal(tasksById(full.body)['d1-table'].obtainedMarks, 4);
  assert.equal(tasksById(full.body)['d1-table'].status, 'correct');

  // Only half of them -> half the marks, flagged as partial.
  const partial = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'd1-table': 'create table x (year, thermal)' } },
  });
  const task = tasksById(partial.body)['d1-table'];
  assert.equal(task.status, 'partial');
  assert.equal(task.obtainedMarks, 2);
});

test('practical tasks are held for an examiner instead of scored as zero', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e2-subject': 'Republic Day Function Arrangements' } },
  });

  const tasks = tasksById(response.body);
  // b1-data is Excel formatting work the API cannot observe.
  assert.equal(tasks['b1-data'].grading, 'manual');
  assert.ok(['manual-review', 'not-attempted'].includes(tasks['b1-data'].status));

  // The written subtotal is separate from the marks awaiting an examiner.
  assert.equal(response.body.autoTotalMarks + response.body.manualMarks, 50);
  assert.equal(response.body.status, 'pending-review');
});

test('the totals add up across every part', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e1-recipient': 'apego@nic.in' } },
  });

  assert.equal(response.body.totalMarks, 50);
  assert.equal(
    response.body.parts.reduce((total, part) => total + part.totalMarks, 0),
    50
  );
  assert.equal(
    response.body.parts.reduce((total, part) => total + part.obtainedMarks, 0),
    response.body.obtainedMarks
  );
  assert.ok(response.body.submittedAt);
});

test('POST /api/exam/submit tolerates a body without answers', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', { method: 'POST', token });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.parts.length, 5);
  assert.equal(response.body.obtainedMarks, 0);
});

test('GET /api/exam/result 404s until the student has submitted', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/result', { token });

  assert.equal(response.status, 404);
});

test('GET /api/exam/result returns the stored result after submitting', async () => {
  const token = await signedInStudent();

  const submitted = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { answers: { 'e2-subject': 'Republic Day Function Arrangements' } },
  });

  const stored = await api('/api/exam/result', { token });

  assert.equal(stored.status, 200, JSON.stringify(stored.body));
  assert.equal(stored.body.result.obtainedMarks, submitted.body.obtainedMarks);
  assert.equal(stored.body.result.parts.length, 5);
  assert.equal(
    tasksById(stored.body.result)['e2-subject'].obtainedMarks,
    1
  );
});

test('a student only ever sees their own result', async () => {
  const mine = await signedInStudent();
  await api('/api/exam/submit', {
    method: 'POST',
    token: mine,
    body: { answers: { 'e2-subject': 'Republic Day Function Arrangements' } },
  });

  // A different student has no attempt of their own.
  const other = await signedInStudent();
  const response = await api('/api/exam/result', { token: other });

  assert.equal(response.status, 404);
});

test('the served paper never leaks a mutation of the shared copy', async () => {
  const token = await signedInStudent();
  const first = await api('/api/exam', { token });
  const second = await api('/api/exam', { token });

  first.body.exam.parts[0].name = 'Tampered';
  assert.equal(second.body.exam.parts[0].name, 'Word');
});
