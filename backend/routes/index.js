'use strict';

/**
 * API router: every route is mounted under /api.
 */

const express = require('express');

const authRoutes = require('./authRoutes');
const examRoutes = require('./examRoutes');
const officeRoutes = require('./officeRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/exam', examRoutes);
router.use('/office', officeRoutes);

module.exports = router;
