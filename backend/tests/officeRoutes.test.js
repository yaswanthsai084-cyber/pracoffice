'use strict';

/**
 * Integration tests for the ONLYOFFICE endpoints.
 *
 * These cover the student-facing status/config endpoints and the two
 * document-server endpoints. The document server itself is not needed: a local
 * HTTP server stands in for it, so the full round trip (config -> download ->
 * callback -> saved file on disk) is exercised without Docker.
 *
 * The service reads `config.office`, which is process-wide and already loaded,
 * so the tests point it at a throw-away directory and switch it on directly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { api, registerUser, stopTestServer, getBaseUrl } = require('./support/serverHarness');

test.after(async () => {
  await stopTestServer();
});

const officeConfig = require('../config/env').office;
const office = require('../services/onlyofficeService');

/** Switches the integration on and points storage at a temp directory. */
const useOffice = () => {
  const original = { enabled: officeConfig.enabled, storageDir: officeConfig.storageDir };
  officeConfig.enabled = true;
  officeConfig.storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pracoffice-routes-'));

  return () => {
    officeConfig.enabled = original.enabled;
    officeConfig.storageDir = original.storageDir;
    fs.rmSync(officeConfig.storageDir, { recursive: true, force: true });
  };
};

/** Registers a student and returns their token and user id. */
const signedInStudent = async () => {
  const response = await registerUser();
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { token: response.body.token, userId: response.body.user.id };
};

test('GET /api/office/status requires a signed-in student', async () => {
  const response = await api('/api/office/status');
  assert.equal(response.status, 401);
});

test('GET /api/office/status reports the integration is off by default', async () => {
  const restore = useOffice();
  officeConfig.enabled = false;

  try {
    const { token } = await signedInStudent();
    const response = await api('/api/office/status', { token });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.enabled, false);
    assert.match(response.body.apiUrl, /documents\/api\.js$/);
    assert.deepEqual(response.body.parts, ['word', 'excel', 'powerpoint']);
  } finally {
    restore();
  }
});

test('GET /api/office/status reports the integration is on when enabled', async () => {
  const restore = useOffice();

  try {
    const { token } = await signedInStudent();
    const response = await api('/api/office/status', { token });

    assert.equal(response.status, 200);
    assert.equal(response.body.enabled, true);
    assert.match(response.body.apiUrl, /^http.*\/web-apps\/apps\/api\/documents\/api\.js$/);
  } finally {
    restore();
  }
});

test('the config endpoint is unavailable, not broken, when office is off', async () => {
  const restore = useOffice();
  officeConfig.enabled = false;

  try {
    const { token } = await signedInStudent();
    const response = await api('/api/office/config/word', { token });

    // The frontend must be able to fall back without treating this as an error.
    assert.equal(response.status, 200);
    assert.equal(response.body.available, false);
    assert.equal(response.body.reason, 'disabled');
  } finally {
    restore();
  }
});

test('GET /api/office/config/:partId returns a signed editor config', async () => {
  const restore = useOffice();

  try {
    const { token, userId } = await signedInStudent();
    const response = await api('/api/office/config/word', { token });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.available, true);
    assert.equal(response.body.partId, 'word');
    assert.equal(response.body.config.documentType, 'word');
    assert.equal(response.body.config.document.fileType, 'docx');
    assert.match(response.body.apiUrl, /documents\/api\.js$/);

    // The download URL must carry its own token: the document server has no
    // session, so it can only be authenticated from inside the URL.
    assert.match(response.body.config.document.url, /\btoken=/);
    assert.match(response.body.config.document.url, /userId=/);

    // The config itself is signed for the callback.
    assert.ok(response.body.config.token, 'the config should be signed');
    const verified = office.verifyToken(response.body.config.token);
    assert.equal(verified.document.key, response.body.config.document.key);

    // Opening the editor created this student's working file.
    assert.equal(fs.existsSync(office.filePath(userId, 'word')), true);
  } finally {
    restore();
  }
});

test('an unknown part is a 404, but only once office is enabled', async () => {
  const restore = useOffice();

  try {
    const { token } = await signedInStudent();
    const response = await api('/api/office/config/nosuchpart', { token });

    assert.equal(response.status, 404);
  } finally {
    restore();
  }
});

/* ------------------------------------------------ the document server side -- */

/**
 * Starts a local HTTP server standing in for ONLYOFFICE.
 *
 * It serves the "edited" document at `/edited.docx`, which is the URL a real
 * callback body would carry, so the download-and-save path is exercised for
 * real rather than mocked.
 */
const startFakeDocumentServer = (contents) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(contents);
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/edited.docx`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });

test('the file endpoint refuses a request with no document server token', async () => {
  const restore = useOffice();

  try {
    const { userId } = await signedInStudent();
    const base = await getBaseUrl();

    const missing = await fetch(`${base}/api/office/file?userId=${userId}&part=word&key=abc`);
    assert.equal(missing.status, 401);

    const forged = await fetch(
      `${base}/api/office/file?userId=${userId}&part=word&key=abc&token=not-a-jwt`
    );
    assert.equal(forged.status, 401);
  } finally {
    restore();
  }
});

test('the file endpoint serves a real .docx to a correctly signed request', async () => {
  const restore = useOffice();

  try {
    const { token, userId } = await signedInStudent();
    const { body } = await api('/api/office/config/word', { token });
    const key = body.config.document.key;

    // The URL we handed the document server already carries its own token.
    const url = new URL(body.config.document.url);
    assert.ok(url.searchParams.get('token'), 'the download URL must carry a token');

    const response = await fetch(`${await getBaseUrl()}${url.pathname}${url.search}`);

    // NOTE: the status is asserted before the body is read, because reading
    // the body twice throws ("Body is unusable").
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const bytes = Buffer.from(await response.arrayBuffer());
    // A real .docx is a ZIP archive: it starts with the "PK" signature.
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    assert.ok(bytes.length > 0);
    assert.ok(key.length <= 128);
    assert.equal(office.filePath(userId, 'word').endsWith('document.docx'), true);
  } finally {
    restore();
  }

test('a valid token for one document cannot fetch a different document', async () => {
  const restore = useOffice();

  try {
    const { token, userId } = await signedInStudent();
    const { body } = await api('/api/office/config/word', { token });
    const goodKey = body.config.document.key;

    // A token signed over the real key, replayed against a different key.
    const response = await fetch(
      `${await getBaseUrl()}/api/office/file?userId=${userId}&part=word&key=other-key&token=` +
        encodeURIComponent(office.signToken({ key: goodKey }))
    );

    assert.equal(response.status, 403);
  } finally {
    restore();
  }
});

test('a callback with status 2 downloads and saves the edited document', async () => {
  const restore = useOffice();

  try {
    const { token, userId } = await signedInStudent();
    const { body } = await api('/api/office/config/word', { token });
    const configKey = body.config.document.key;

    // A document recognisably different from the blank one.
    const edited = Buffer.from('THE-STUDENT-EDITED-THIS');
    const editedKey = office.documentKey(userId, 'word', edited);
    const fake = await startFakeDocumentServer(edited);

    const response = await api(
      `/api/office/callback?userId=${userId}&part=word&key=${editedKey}`,
      {
        method: 'POST',
        body: {
          key: editedKey,
          status: 2,
          url: fake.url,
          // The callback token is the whole signed config, not the narrow
          // file-download token, so the key is read from `document.key`.
          token: office.signToken({ document: { key: editedKey } }),
        },
      }
    );

    // { error: 0 } is the only success reply the document server accepts.
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.error, 0);

    const saved = await office.readDocument(userId, 'word');
    assert.deepEqual(saved, edited, 'the callback bytes must reach disk');

    await fake.close();
    assert.ok(configKey, 'sanity: the config itself was signed');
  } finally {
    restore();
  }
});

});

test('a callback with status 4 is acknowledged without touching the file', async () => {
  const restore = useOffice();

  try {
    const { token, userId } = await signedInStudent();
    const { body } = await api('/api/office/config/word', { token });
    const key = body.config.document.key;
    const before = await office.readDocument(userId, 'word');

    const response = await api(
      `/api/office/callback?userId=${userId}&part=word&key=${key}`,
      {
        method: 'POST',
        body: { key, status: 4, token: office.signToken({ document: { key } }) },
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.error, 0);
    // Nobody edited the document, so the working copy is untouched.
    assert.deepEqual(await office.readDocument(userId, 'word'), before);
  } finally {
    restore();
  }
});

test('a callback with no document server token is rejected', async () => {
  const restore = useOffice();

  try {
    const { userId } = await signedInStudent();
    const response = await api(`/api/office/callback?userId=${userId}&part=word&key=abc`, {
      method: 'POST',
      body: { key: 'abc', status: 2 },
    });

    // Authentication runs before the body is inspected, so a missing token is a
    // 401 even when the rest of the request looks well formed.
    assert.equal(response.status, 401);
  } finally {
    restore();
  }
});

test('a callback for a part with no editor is refused', async () => {
  const restore = useOffice();

  try {
    const { userId } = await signedInStudent();
    const response = await api(`/api/office/callback?userId=${userId}&part=email&key=abc`, {
      method: 'POST',
      body: { key: 'abc', status: 2, token: office.signToken({ key: 'abc' }) },
    });

    assert.equal(response.status, 400);
  } finally {
    restore();
  }
});


