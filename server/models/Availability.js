const mongoose = require('mongoose')

const dayAvailabilitySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
    },

    available: {
      type: Boolean,
      default: false,
    },

    startTime: {
      type: String,
      default: '',
    },

    endTime: {
      type: String,
      default: '',
    },
  },
  { _id: false },
)

const availabilitySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    weekStart: {
      type: String,
      required: true,
    },

    availability: {
      type: [dayAvailabilitySchema],
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

availabilitySchema.index(
  {
    employeeId: 1,
    weekStart: 1,
  },
  {
    unique: true,
  },
)

module.exports = mongoose.model('Availability', availabilitySchema)
