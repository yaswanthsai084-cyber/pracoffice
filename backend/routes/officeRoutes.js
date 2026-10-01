'use strict';

/**
 * ONLYOFFICE Docs endpoints.
 *
 *   GET  /api/office/status          is the editor integration switched on?
 *   GET  /api/office/config/:partId  the signed editor config for a part
 *   GET  /api/office/file            the source file (called by the doc server)
 *   POST /api/office/callback        the saved file   (called by the doc server)
 *
 * The first two are used by the signed-in student and need a normal JWT. The
 * last two are called by the ONLYOFFICE document server, which has no session
 * and no user account, so they are authenticated by ONLYOFFICE's own signed
 * token instead - see `middleware/officeAuth.js`.
 *
 * Order matters: the two document-server routes are declared before
 * `authenticate`, because that middleware would otherwise reject every callback
 * as an anonymous student.
 */

const express = require('express');

const officeController = require('../controllers/officeController');
const { authenticate } = require('../middleware/auth');
const { requireOfficeToken } = require('../middleware/officeAuth');

const router = express.Router();

// Called by the document server: authenticated by the shared ONLYOFFICE JWT.
router.get('/file', requireOfficeToken, officeController.getSourceFile);
router.post('/callback', requireOfficeToken, officeController.handleCallback);

// Called by the signed-in student.
router.use(authenticate);

router.get('/status', officeController.getStatus);
router.get('/config/:partId', officeController.getConfig);

module.exports = router;
