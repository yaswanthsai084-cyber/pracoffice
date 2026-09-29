'use strict';

/**
 * exam_attempts table: one graded submission per signed-in student.
 *
 * Stores the score *and* the full per-task breakdown as JSON so the results
 * page can render exactly what was marked later, even after a reload, and even
 * if the paper is edited afterwards.
 *
 * `answers` keeps the raw typed answers (useful for an examiner reviewing a
 * disputed mark); `result` keeps the graded breakdown the dashboard renders.
 */

module.exports = (sequelize, DataTypes, jsonType) => {
  const ExamAttempt = sequelize.define(
    'ExamAttempt',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      total_marks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Marks the API could award on its own, and out of the auto-markable
      // subtotal. Kept separate from the paper total so a result never implies
      // that the manual practical work was marked as zero.
      auto_obtained_marks: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      auto_total_marks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Marks that still need an examiner (formatting / layout tasks).
      manual_marks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      answers: {
        type: jsonType,
        allowNull: false,
        defaultValue: {},
      },
      result: {
        type: jsonType,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: 'exam_attempts',
      indexes: [{ fields: ['user_id'] }],
    }
  );

  return ExamAttempt;
};
