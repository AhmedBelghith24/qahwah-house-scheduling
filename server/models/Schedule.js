const mongoose = require('mongoose')

// ======================================================
// INDIVIDUAL SHIFT
// ======================================================

const shiftSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    // Optional station assignment.
    // We are NOT using this to decide
    // whether an employee can be scheduled.
    assignedRole: {
      type: String,
      enum: [
        'Cashier',
        'Espresso Station',
        'Yemeni Station',
        'Pickup Station',
        '',
      ],
      default: '',
    },
  },
  {
    _id: true,
  },
)

// ======================================================
// WEEKLY SCHEDULE
// ======================================================

const scheduleSchema = new mongoose.Schema(
  {
    // Example: 2026-09-21
    weekStart: {
      type: String,
      required: true,
      unique: true,
    },

    shifts: {
      type: [shiftSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ['Draft', 'Published'],
      default: 'Draft',
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('Schedule', scheduleSchema)
