'use strict';

/**
 * Auth endpoints: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 */

const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const session = await authService.register(req.body);

  res.status(201).json({
    message: 'User registered successfully. Your password is your mobile number.',
    user: session.user,
    token: session.token,
    expiresIn: session.expiresIn,
  });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);

  res.status(200).json({
    message: 'Login successful',
    user: session.user,
    token: session.token,
    expiresIn: session.expiresIn,
  });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.status(200).json({ user });
});

module.exports = { register, login, me };
