'use strict';

/**
 * API router: every route is mounted under /api.
 */

const express = require('express');

const authRoutes = require('./authRoutes');
const examRoutes = require('./examRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/exam', examRoutes);

module.exports = router;
