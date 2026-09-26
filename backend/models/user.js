'use strict';

/**
 * users table (PLAN.md):
 * id | name | email | mobile | dob | username | password | created_at
 *
 * `password` stores the hashed mobile number. The default scope never returns
 * the hash; use `User.scope('withPassword')` when the hash is required (login).
 */

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: { msg: 'Name is required' } },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: { msg: 'Email is not valid' } },
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: { notEmpty: { msg: 'Mobile number is required' } },
      },
      dob: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: { isDate: { msg: 'Date of birth is not valid' } },
      },
      username: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
        validate: { notEmpty: { msg: 'Username is required' } },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'users',
      defaultScope: {
        attributes: { exclude: ['password'] },
      },
      scopes: {
        withPassword: { attributes: { include: ['password'] } },
      },
      indexes: [{ unique: true, fields: ['email'] }, { unique: true, fields: ['username'] }],
    }
  );

  /** Shape returned to the client (never exposes the password hash). */
  User.prototype.toPublicJSON = function toPublicJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      mobile: this.mobile,
      dob: this.dob,
      username: this.username,
      createdAt: this.created_at || this.createdAt,
    };
  };

  return User;
};
