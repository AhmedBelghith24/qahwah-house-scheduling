const express = require('express')
const router = express.Router()

const Availability = require('../models/Availability')
const Employee = require('../models/Employee')

const { auth, adminOnly } = require('../middleware/auth')

// ==========================================================
// HELPERS
// ==========================================================

const validDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// ----------------------------------------------------------
// Parse YYYY-MM-DD as a LOCAL date
// ----------------------------------------------------------

const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)

  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

// ----------------------------------------------------------
// Get Monday of the current week
// ----------------------------------------------------------

const getCurrentMonday = () => {
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  const day = today.getDay()

  const difference = day === 0 ? -6 : 1 - day

  const monday = new Date(today)

  monday.setDate(today.getDate() + difference)

  monday.setHours(0, 0, 0, 0)

  return monday
}

// ----------------------------------------------------------
// Check whether a week is already over
//
// A week starts Monday.
// Once the following Monday arrives,
// the previous week can no longer be edited.
// ----------------------------------------------------------

const isPastWeek = (weekStart) => {
  const selectedMonday = parseLocalDate(weekStart)

  const currentMonday = getCurrentMonday()

  return selectedMonday < currentMonday
}

// ==========================================================
// GET ALL AVAILABILITY
// ADMIN ONLY
//
// GET /api/availability
// ==========================================================

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const records = await Availability.find()
      .populate('employeeId', 'firstName lastName email roles status')
      .sort({
        weekStart: -1,
      })

    res.json(records)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve availability.',
    })
  }
})

// ==========================================================
// GET MY AVAILABILITY
// EMPLOYEE ONLY
//
// GET /api/availability/me
// ==========================================================

router.get('/me', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        message: 'Employee access required.',
      })
    }

    if (!req.user.employeeId) {
      return res.status(400).json({
        message: 'No employee profile is linked to this account.',
      })
    }

    const records = await Availability.find({
      employeeId: req.user.employeeId,
    }).sort({
      weekStart: -1,
    })

    res.json(records)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve your availability.',
    })
  }
})

// ==========================================================
// CREATE / UPDATE / REMOVE MY AVAILABILITY
// EMPLOYEE ONLY
//
// POST /api/availability/me
//
// Rules:
//
// 1. Past weeks cannot be modified.
//
// 2. At least one available day:
//    create/update availability.
//
// 3. Zero available days:
//    delete the week's availability record.
//
// Availability is effective immediately.
// No manager approval.
// ==========================================================

router.post('/me', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        message: 'Employee access required.',
      })
    }

    const employeeId = req.user.employeeId

    const { weekStart, availability } = req.body

    // ====================================================
    // VALIDATE EMPLOYEE
    // ====================================================

    if (!employeeId) {
      return res.status(400).json({
        message: 'No employee profile is linked to this account.',
      })
    }

    const employee = await Employee.findById(employeeId)

    if (!employee) {
      return res.status(404).json({
        message: 'Employee profile not found.',
      })
    }

    if (employee.status === 'Inactive') {
      return res.status(403).json({
        message: 'This employee account is inactive.',
      })
    }

    // ====================================================
    // VALIDATE BODY
    // ====================================================

    if (!weekStart || !Array.isArray(availability)) {
      return res.status(400).json({
        message: 'Week and availability are required.',
      })
    }

    // YYYY-MM-DD
    const weekPattern = /^\d{4}-\d{2}-\d{2}$/

    if (!weekPattern.test(weekStart)) {
      return res.status(400).json({
        message: 'Invalid week.',
      })
    }

    // ====================================================
    // PAST WEEK PROTECTION
    // ====================================================

    if (isPastWeek(weekStart)) {
      return res.status(403).json({
        message: 'Availability for a completed week can no longer be changed.',
      })
    }

    // ====================================================
    // VALIDATE 7 DAYS
    // ====================================================

    if (availability.length !== 7) {
      return res.status(400).json({
        message: 'Availability must contain all 7 days of the week.',
      })
    }

    const receivedDays = availability.map((day) => day.day)

    const uniqueDays = new Set(receivedDays)

    if (
      uniqueDays.size !== 7 ||
      !validDays.every((day) => uniqueDays.has(day))
    ) {
      return res.status(400).json({
        message:
          'Availability must contain Monday through Sunday exactly once.',
      })
    }

    // ====================================================
    // VALIDATE DAY DATA
    // ====================================================

    for (const day of availability) {
      if (typeof day.available !== 'boolean') {
        return res.status(400).json({
          message: `${day.day} availability must be true or false.`,
        })
      }

      if (day.available && (!day.startTime || !day.endTime)) {
        return res.status(400).json({
          message: `${day.day} requires a start and end time.`,
        })
      }

      if (day.available && day.startTime >= day.endTime) {
        return res.status(400).json({
          message: `${day.day} end time must be after start time.`,
        })
      }
    }

    // ====================================================
    // NORMALIZE
    // ====================================================

    const normalizedAvailability = availability.map((day) => ({
      day: day.day,

      available: day.available,

      startTime: day.available ? day.startTime : '',

      endTime: day.available ? day.endTime : '',
    }))

    // ====================================================
    // CHECK WHETHER ANY DAY IS AVAILABLE
    // ====================================================

    const hasAvailableDays = normalizedAvailability.some((day) => day.available)

    // ====================================================
    // NO AVAILABLE DAYS
    //
    // Remove the week completely.
    // This also removes it from history because GET /me
    // will no longer return the record.
    // ====================================================

    if (!hasAvailableDays) {
      const deletedRecord = await Availability.findOneAndDelete({
        employeeId,
        weekStart,
      })

      return res.status(200).json({
        deleted: true,

        weekStart,

        message: deletedRecord
          ? 'Availability removed successfully.'
          : 'No availability was saved for this week.',
      })
    }

    // ====================================================
    // CREATE OR UPDATE AVAILABILITY
    // ====================================================

    const record = await Availability.findOneAndUpdate(
      {
        employeeId,
        weekStart,
      },
      {
        employeeId,
        weekStart,

        availability: normalizedAvailability,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    )

    return res.status(200).json(record)
  } catch (error) {
    console.error('Save availability error:', error)

    res.status(500).json({
      message: 'Unable to save availability.',
    })
  }
})

module.exports = router
