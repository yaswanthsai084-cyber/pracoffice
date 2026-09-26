'use strict';

/**
 * Integration tests for the authentication endpoints.
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *
 * The payloads mirror the frontend Registration / Login forms.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { api, registerUser, stopTestServer } = require('./support/serverHarness');

test.after(async () => {
  await stopTestServer();
});

test('register creates a user from the registration form payload and returns a token', async () => {
  const response = await registerUser();

  assert.equal(response.status, 201);
  assert.ok(response.body.token, 'a JWT should be returned');
  assert.equal(response.body.user.username, response.credentials.username);
  assert.equal(response.body.user.email, response.credentials.email);
  assert.equal(response.body.user.mobile, response.credentials.mobileNumber);
  assert.equal(response.body.user.dob, response.credentials.dateOfBirth);
  assert.equal(response.body.user.password, undefined, 'the password hash must never be sent');
  assert.ok(response.body.expiresIn);
});

test('register derives a username when the client omits it', async () => {
  const response = await registerUser({ username: undefined });

  assert.equal(response.status, 201);
  assert.match(response.body.user.username, /^student/, 'username is derived from the email');
  assert.equal(response.body.user.name, response.body.user.username, 'name defaults to the username');
});

test('register rejects a duplicate email with 409', async () => {
  const first = await registerUser();
  const second = await registerUser({ email: first.credentials.email, mobileNumber: '9550000001' });

  assert.equal(second.status, 409);
  assert.match(second.body.message, /already registered/i);
});

test('register rejects a duplicate mobile number with 409', async () => {
  const first = await registerUser();
  const second = await registerUser({
    mobileNumber: first.credentials.mobileNumber,
    email: `other${Date.now().toString().slice(-7)}@example.com`,
  });

  assert.equal(second.status, 409);
  assert.match(second.body.message, /already registered/i);
});

test('register rejects a duplicate username with 409', async () => {
  const first = await registerUser();
  const second = await registerUser({
    username: first.credentials.username,
    email: `other${Date.now().toString().slice(-7)}@example.com`,
    mobileNumber: '9550000002',
  });

  assert.equal(second.status, 409);
  assert.match(second.body.message, /username/i);
});

test('register rejects invalid input with 400 and field errors', async () => {
  const response = await api('/api/auth/register', {
    method: 'POST',
    body: { username: 'ab', mobileNumber: '12', email: 'not-an-email', dateOfBirth: 'not-a-date' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Validation failed');
  assert.ok(Array.isArray(response.body.errors));
  const fields = response.body.errors.map((error) => error.field).sort();
  assert.deepEqual(fields, ['dateOfBirth', 'email', 'mobileNumber', 'username']);
});

test('register rejects a 9 digit mobile number', async () => {
  const response = await registerUser({ mobileNumber: '912345678' });
  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].field, 'mobileNumber');
});

test('register accepts the legacy field names (mobileno / dob)', async () => {
  const unique =
    `${Date.now()}`.slice(-7) + `${Math.floor(Math.random() * 1000)}`.padStart(3, '0');
  const response = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: `legacy${unique}@example.com`,
      mobileno: `9${unique}`.slice(0, 10),
      dob: '1999-12-31',
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.mobile, `9${unique}`.slice(0, 10));
  assert.equal(response.body.user.dob, '1999-12-31');
});

test('login works with the username and the mobile number as password', async () => {
  const registration = await registerUser();
  const { username, mobileNumber } = registration.credentials;

  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { username, password: mobileNumber },
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.username, username);
  assert.equal(response.body.user.password, undefined);
});

test('login also accepts the email address', async () => {
  const registration = await registerUser();

  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { email: registration.credentials.email, password: registration.credentials.mobileNumber },
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
});

test('login fails with a wrong password', async () => {
  const registration = await registerUser();

  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { username: registration.body.user.username, password: '0000000000' },
  });

  assert.equal(response.status, 401);
  assert.match(response.body.message, /incorrect/i);
});

test('login requires an identifier', async () => {
  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { password: '9123456789' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].field, 'username');
});

test('GET /api/auth/me returns the profile for a valid token', async () => {
  const registration = await registerUser();
  assert.equal(
    registration.status,
    201,
    `registration should succeed, got: ${JSON.stringify(registration.body)}`
  );

  const response = await api('/api/auth/me', { token: registration.body.token });

  assert.equal(
    response.status,
    200,
    `/me should accept the fresh token, got: ${JSON.stringify(response.body)}`
  );
  assert.equal(response.body.user.username, registration.body.user.username);
  assert.equal(response.body.user.password, undefined);
  assert.ok(response.body.user.createdAt, 'created_at is exposed as createdAt');
});

test('GET /api/auth/me rejects missing and malformed tokens', async () => {
  const missing = await api('/api/auth/me');
  assert.equal(missing.status, 401);

  const invalid = await api('/api/auth/me', { token: 'not.a.real.token' });
  assert.equal(invalid.status, 401);
  assert.match(invalid.body.message, /invalid/i);
});

test('GET /api/health reports ok', async () => {
  const response = await api('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'sqlite');
});

test('unknown routes return a JSON 404', async () => {
  const response = await api('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.match(response.body.message, /does not exist/i);
});
