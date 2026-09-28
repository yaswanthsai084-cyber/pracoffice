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

test('POST /api/exam/submit accepts the attempt and reports it as pending', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', {
    method: 'POST',
    token,
    body: { parts: {} },
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.totalMarks, 50);
  assert.equal(response.body.status, 'pending');
  assert.ok(response.body.submittedAt);
  assert.equal(response.body.parts.length, 5);
  assert.equal(
    response.body.parts.reduce((total, part) => total + part.totalMarks, 0),
    50
  );
});

test('POST /api/exam/submit tolerates a body without parts', async () => {
  const token = await signedInStudent();
  const response = await api('/api/exam/submit', { method: 'POST', token });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.parts.length, 5);
});

test('the served paper never leaks a mutation of the shared copy', async () => {
  const token = await signedInStudent();
  const first = await api('/api/exam', { token });
  const second = await api('/api/exam', { token });

  first.body.exam.parts[0].name = 'Tampered';
  assert.equal(second.body.exam.parts[0].name, 'Word');
});
