const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    roles: {
      type: [String],
      required: true,
      enum: ['Cashier', 'Espresso Station', 'Yemeni Station', 'Pickup Station'],
    },

    maxWeeklyHours: {
      type: Number,
      default: 40,
      min: 1,
      max: 60,
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('Employee', employeeSchema)
