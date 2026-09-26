'use strict';

/**
 * Model registry: creates the models on the shared Sequelize instance and
 * exposes sync helpers.
 */

const { sequelize, Sequelize, DataTypes, jsonType, dialect } = require('../config/database');
const config = require('../config/env');

const defineUser = require('./user');

const User = defineUser(sequelize, DataTypes);

/**
 * Creates any missing tables.
 * `alter` is opt-in (DB_SYNC_ALTER=true) because it is destructive on some
 * dialects and should never run implicitly in production.
 */
const syncDatabase = async ({ alter = config.db.syncAlter, force = false } = {}) => {
  if (config.isProduction && (alter || force)) {
    throw new Error('Refusing to alter/drop tables in production.');
  }

  await sequelize.sync({ alter, force });
  return true;
};

module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  jsonType,
  dialect,
  User,
  syncDatabase,
};
