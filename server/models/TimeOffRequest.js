const mongoose = require('mongoose')

const timeOffRequestSchema = new mongoose.Schema(
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

    allDay: {
      type: Boolean,
      default: true,
    },

    startTime: {
      type: String,
      default: '',
    },

    endTime: {
      type: String,
      default: '',
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Denied'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('TimeOffRequest', timeOffRequestSchema)
