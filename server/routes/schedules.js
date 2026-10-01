const express = require('express')
const router = express.Router()

const Schedule = require('../models/Schedule')
const Employee = require('../models/Employee')
const Availability = require('../models/Availability')
const TimeOffRequest = require('../models/TimeOffRequest')

const { auth, adminOnly } = require('../middleware/auth')

const { runScheduleOptimizer } = require('../services/scheduleOptimizer')

// ============================================================
// DAYS
// ============================================================

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// ============================================================
// SCHEDULING RULES
// ============================================================

// We want 2 employees working at all times.
const REQUIRED_COVERAGE = 2

// Coverage is checked every 30 minutes,
// matching the OR-Tools optimizer.
const COVERAGE_BLOCK_MINUTES = 30

// Maximum 8 hours per employee per day.
const MAX_DAILY_MINUTES = 8 * 60

// Maximum 40 hours per employee per week.
const MAX_WEEKLY_MINUTES = 40 * 60

// ============================================================
// STORE / COVERAGE HOURS
// ============================================================
//
// Sunday - Thursday:
// 8:00 AM - 9:00 PM
//
// Friday - Saturday:
// 8:00 AM - 10:00 PM
// ============================================================

const schedulingHours = {
  Monday: {
    open: '08:00',
    close: '21:00',
  },

  Tuesday: {
    open: '08:00',
    close: '21:00',
  },

  Wednesday: {
    open: '08:00',
    close: '21:00',
  },

  Thursday: {
    open: '08:00',
    close: '21:00',
  },

  Friday: {
    open: '08:00',
    close: '22:00',
  },

  Saturday: {
    open: '08:00',
    close: '22:00',
  },

  Sunday: {
    open: '08:00',
    close: '21:00',
  },
}

// ============================================================
// TIME HELPER
//
// "08:30" -> 510
// ============================================================

const timeToMinutes = (time) => {
  if (!time) {
    return 0
  }

  const [hours, minutes] = time.split(':').map(Number)

  return hours * 60 + minutes
}

// ============================================================
// MINUTES TO TIME
//
// 510 -> "08:30"
// ============================================================

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60)

  const mins = minutes % 60

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// ============================================================
// DATE HELPER
//
// Adds days to YYYY-MM-DD without timezone shifting.
// ============================================================

const addDays = (dateString, amount) => {
  const [year, month, day] = dateString.split('-').map(Number)

  const date = new Date(Date.UTC(year, month - 1, day))

  date.setUTCDate(date.getUTCDate() + amount)

  return date.toISOString().split('T')[0]
}

// ============================================================
// CALCULATE COVERAGE ISSUES
// ============================================================
//
// IMPORTANT:
//
// Coverage is NOT stored separately in MongoDB.
//
// Instead, we calculate coverage from the CURRENT saved shifts.
//
// This prevents stale coverage information after:
//
// - Browser refresh
// - Leaving and returning to the page
// - Adding a shift
// - Editing a shift
// - Deleting a shift
//
// Every 30-minute period is checked.
//
// 0 employees = needs 2
// 1 employee  = needs 1
// 2+          = fully covered
// ============================================================

const calculateCoverageIssues = (schedule) => {
  const coverageIssues = []

  if (!schedule || !schedule.weekStart) {
    return coverageIssues
  }

  // ==========================================================
  // CHECK EACH DAY
  // ==========================================================

  days.forEach((dayName, dayIndex) => {
    const date = addDays(schedule.weekStart, dayIndex)

    const dayOpen = timeToMinutes(schedulingHours[dayName].open)

    const dayClose = timeToMinutes(schedulingHours[dayName].close)

    // ======================================================
    // CHECK EVERY 30-MINUTE BLOCK
    // ======================================================

    for (
      let blockStart = dayOpen;
      blockStart < dayClose;
      blockStart += COVERAGE_BLOCK_MINUTES
    ) {
      const blockEnd = Math.min(blockStart + COVERAGE_BLOCK_MINUTES, dayClose)

      // ====================================================
      // UNIQUE EMPLOYEES WORKING DURING THIS BLOCK
      // ====================================================

      const workingEmployees = new Set()

      schedule.shifts.forEach((shift) => {
        // Different date.
        if (shift.date !== date) {
          return
        }

        const shiftStart = timeToMinutes(shift.startTime)

        const shiftEnd = timeToMinutes(shift.endTime)

        // ================================================
        // DOES SHIFT OVERLAP THIS COVERAGE BLOCK?
        // ================================================

        const overlaps = shiftStart < blockEnd && shiftEnd > blockStart

        if (!overlaps) {
          return
        }

        // ================================================
        // employeeId MAY BE:
        //
        // ObjectId
        //
        // OR
        //
        // populated Employee document
        // ================================================

        const employeeId = shift.employeeId?._id
          ? shift.employeeId._id.toString()
          : shift.employeeId?.toString()

        if (employeeId) {
          workingEmployees.add(employeeId)
        }
      })

      const scheduled = workingEmployees.size

      // ====================================================
      // COVERAGE PROBLEM
      // ====================================================

      if (scheduled < REQUIRED_COVERAGE) {
        coverageIssues.push({
          date,

          day: dayName,

          startTime: minutesToTime(blockStart),

          endTime: minutesToTime(blockEnd),

          required: REQUIRED_COVERAGE,

          scheduled,
        })
      }
    }
  })

  return coverageIssues
}

// ============================================================
// ADMIN
// GET SCHEDULE FOR WEEK
// ============================================================
//
// This now recalculates coverage every time the page loads.
//
// Therefore refreshing the browser does NOT lose coverage
// information anymore.
// ============================================================

router.get('/week/:weekStart', auth, adminOnly, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      weekStart: req.params.weekStart,
    }).populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    if (!schedule) {
      return res.status(404).json({
        message: 'No schedule found for this week.',
      })
    }

    // ======================================================
    // RECALCULATE COVERAGE FROM SAVED SHIFTS
    // ======================================================

    const coverageIssues = calculateCoverageIssues(schedule)

    res.json({
      schedule,

      coverageIssues,
    })
  } catch (error) {
    console.error('Get schedule error:', error)

    res.status(500).json({
      message: 'Unable to retrieve schedule.',
    })
  }
})

// ============================================================
// ADMIN
// GENERATE OPTIMIZED WEEKLY SCHEDULE
//
// MongoDB
//    ↓
// Express
//    ↓
// Python OR-Tools
//    ↓
// CP-SAT
//    ↓
// Express
//    ↓
// MongoDB Schedule
// ============================================================

router.post('/generate', auth, adminOnly, async (req, res) => {
  try {
    const { weekStart } = req.body

    // ======================================================
    // VALIDATE WEEK
    // ======================================================

    if (!weekStart) {
      return res.status(400).json({
        message: 'Week start is required.',
      })
    }

    // ======================================================
    // ACTIVE EMPLOYEES
    // ======================================================

    const employees = await Employee.find({
      status: 'Active',
    })

    if (employees.length === 0) {
      return res.status(400).json({
        message: 'No active employees were found.',
      })
    }

    // ======================================================
    // EMPLOYEE AVAILABILITY
    //
    // Availability becomes effective immediately when
    // an employee saves it. No admin approval is required.
    // ======================================================

    const availabilityRecords = await Availability.find({
      weekStart,
    })

    // ======================================================
    // WEEK END
    // ======================================================

    const weekEnd = addDays(weekStart, 6)

    // ======================================================
    // APPROVED TIME OFF
    // ======================================================

    const timeOffRequests = await TimeOffRequest.find({
      status: 'Approved',

      date: {
        $gte: weekStart,

        $lte: weekEnd,
      },
    })

    // ======================================================
    // BUILD OR-TOOLS EMPLOYEE DATA
    // ======================================================

    const optimizerEmployees = employees.map((employee) => {
      const employeeId = employee._id.toString()

      const availabilityRecord = availabilityRecords.find(
        (record) => record.employeeId.toString() === employeeId,
      )

      const employeeAvailability = {}

      // =================================================
      // DEFAULT ALL DAYS TO UNAVAILABLE
      // =================================================

      days.forEach((day) => {
        employeeAvailability[day] = {
          available: false,

          startTime: '',

          endTime: '',
        }
      })

      // =================================================
      // COPY EMPLOYEE AVAILABILITY
      // =================================================

      if (availabilityRecord) {
        availabilityRecord.availability.forEach((item) => {
          employeeAvailability[item.day] = {
            available: item.available,

            startTime: item.startTime || '',

            endTime: item.endTime || '',
          }
        })
      }

      return {
        id: employeeId,

        name: `${employee.firstName} ${employee.lastName}`,

        firstName: employee.firstName,

        lastName: employee.lastName,

        maxWeeklyHours: Math.min(employee.maxWeeklyHours || 40, 40),

        availability: employeeAvailability,
      }
    })

    // ======================================================
    // BUILD TIME-OFF DATA FOR PYTHON
    // ======================================================

    const optimizerTimeOff = timeOffRequests.map((request) => ({
      employeeId: request.employeeId.toString(),

      date: request.date,

      allDay: request.allDay,

      startTime: request.startTime || '',

      endTime: request.endTime || '',
    }))

    // ======================================================
    // FINAL INPUT FOR PYTHON
    // ======================================================

    const optimizerInput = {
      weekStart,

      employees: optimizerEmployees,

      timeOff: optimizerTimeOff,
    }

    // ======================================================
    // RUN GOOGLE OR-TOOLS
    // ======================================================

    console.log('Running OR-Tools schedule optimizer...')

    const optimizerResult = await runScheduleOptimizer(optimizerInput)

    console.log('OR-Tools finished:', optimizerResult.status)

    console.log(
      'Solve time:',
      optimizerResult.solver?.solveTimeSeconds,
      'seconds',
    )

    // ======================================================
    // VERIFY RESULT
    // ======================================================

    if (!optimizerResult.success) {
      return res.status(400).json({
        message:
          optimizerResult.message || 'Unable to generate optimized schedule.',
      })
    }

    // ======================================================
    // CONVERT PYTHON SHIFTS TO MONGOOSE FORMAT
    // ======================================================

    const shifts = optimizerResult.shifts.map((shift) => ({
      employeeId: shift.employeeId,

      date: shift.date,

      startTime: shift.startTime,

      endTime: shift.endTime,

      assignedRole: shift.assignedRole || '',
    }))

    // ======================================================
    // CREATE OR REPLACE DRAFT
    // ======================================================

    const schedule = await Schedule.findOneAndUpdate(
      {
        weekStart,
      },

      {
        weekStart,

        shifts,

        status: 'Draft',

        publishedAt: null,
      },

      {
        returnDocument: 'after',

        upsert: true,

        runValidators: true,
      },
    ).populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    // ======================================================
    // CALCULATE COVERAGE FROM THE SAVED SCHEDULE
    //
    // We intentionally calculate this again rather than
    // depending only on the Python response.
    //
    // This makes the backend's coverage logic consistent
    // with refreshes and manual changes.
    // ======================================================

    const coverageIssues = calculateCoverageIssues(schedule)

    // ======================================================
    // RESPONSE
    // ======================================================

    res.json({
      message:
        coverageIssues.length === 0
          ? 'Optimized draft schedule generated with full coverage.'
          : 'Optimized draft schedule generated, but some periods still need additional coverage.',

      schedule,

      coverageIssues,

      optimization: {
        solver: 'Google OR-Tools CP-SAT',

        status: optimizerResult.status,

        solveTimeSeconds: optimizerResult.solver?.solveTimeSeconds,

        objective: optimizerResult.solver?.objective,

        employeeHours: optimizerResult.employeeHours,
      },
    })
  } catch (error) {
    console.error('OR-Tools schedule generation error:', error)

    res.status(500).json({
      message: error.message || 'Unable to generate optimized schedule.',
    })
  }
})
const validateManualShift = async ({
  schedule,
  employeeId,
  date,
  startTime,
  endTime,
  ignoreShiftId = null,
  override = false,
}) => {
  // ========================================================
  // EMPLOYEE MUST EXIST AND BE ACTIVE
  // ========================================================

  const employee = await Employee.findOne({
    _id: employeeId,
    status: 'Active',
  })

  if (!employee) {
    return {
      valid: false,
      message: 'Employee was not found or is inactive.',
    }
  }

  // ========================================================
  // VALIDATE DATE
  // ========================================================

  const weekEnd = addDays(schedule.weekStart, 6)

  if (date < schedule.weekStart || date > weekEnd) {
    return {
      valid: false,
      message: 'Shift date must be inside the selected schedule week.',
    }
  }

  // ========================================================
  // VALIDATE TIME
  // ========================================================

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  if (!startTime || !endTime || endMinutes <= startMinutes) {
    return {
      valid: false,
      message: 'Shift end time must be after the start time.',
    }
  }

  // ========================================================
  // DETERMINE DAY
  // ========================================================

  const dayIndex = days.findIndex(
    (dayName, index) => addDays(schedule.weekStart, index) === date,
  )

  if (dayIndex === -1) {
    return {
      valid: false,
      message: 'Unable to determine the shift day.',
    }
  }

  const dayName = days[dayIndex]

  // ========================================================
  // STORE HOURS — HARD BLOCK
  // ========================================================

  const storeOpen = timeToMinutes(schedulingHours[dayName].open)

  const storeClose = timeToMinutes(schedulingHours[dayName].close)

  if (startMinutes < storeOpen || endMinutes > storeClose) {
    return {
      valid: false,
      message: `${dayName} shifts must be between ${schedulingHours[dayName].open} and ${schedulingHours[dayName].close}.`,
    }
  }

  // ========================================================
  // SHIFT LENGTH — HARD BLOCK
  // ========================================================

  const newShiftMinutes = endMinutes - startMinutes

  if (newShiftMinutes > MAX_DAILY_MINUTES) {
    return {
      valid: false,
      message: 'A shift cannot exceed 8 hours.',
    }
  }

  // ========================================================
  // EXISTING SHIFTS — HARD BLOCKS
  // ========================================================

  let dailyMinutes = 0
  let weeklyMinutes = 0

  for (const shift of schedule.shifts) {
    if (ignoreShiftId && shift._id.toString() === ignoreShiftId.toString()) {
      continue
    }

    const existingEmployeeId = shift.employeeId?._id
      ? shift.employeeId._id.toString()
      : shift.employeeId.toString()

    if (existingEmployeeId !== employeeId.toString()) {
      continue
    }

    const existingStart = timeToMinutes(shift.startTime)

    const existingEnd = timeToMinutes(shift.endTime)

    const duration = existingEnd - existingStart

    weeklyMinutes += duration

    if (shift.date === date) {
      dailyMinutes += duration

      const overlaps = startMinutes < existingEnd && endMinutes > existingStart

      if (overlaps) {
        return {
          valid: false,
          message: 'This employee already has a shift during that time.',
        }
      }
    }
  }

  // ========================================================
  // DAILY LIMIT — HARD BLOCK
  // ========================================================

  if (dailyMinutes + newShiftMinutes > MAX_DAILY_MINUTES) {
    return {
      valid: false,
      message: 'This change would put the employee over 8 hours for the day.',
    }
  }

  // ========================================================
  // WEEKLY LIMIT — HARD BLOCK
  // ========================================================

  const employeeWeeklyLimit = Math.min(employee.maxWeeklyHours || 40, 40) * 60

  if (weeklyMinutes + newShiftMinutes > employeeWeeklyLimit) {
    return {
      valid: false,
      message: `This change would put the employee over their ${Math.min(
        employee.maxWeeklyHours || 40,
        40,
      )}-hour weekly limit.`,
    }
  }

  // ========================================================
  // OVERRIDEABLE WARNINGS
  //
  // We collect ALL warnings so the manager only has to
  // confirm once.
  // ========================================================

  const warnings = []

  // ========================================================
  // AVAILABILITY
  // ========================================================

  const availabilityRecord = await Availability.findOne({
    employeeId,
    weekStart: schedule.weekStart,
  })

  // No availability submitted.
  if (!availabilityRecord) {
    warnings.push({
      type: 'availability',
      title: 'No Availability Submitted',
      message: 'This employee has not submitted availability for this week.',
    })
  } else {
    const dayAvailability = availabilityRecord.availability.find(
      (item) => item.day === dayName,
    )

    // Employee marked the whole day unavailable.
    if (!dayAvailability || !dayAvailability.available) {
      warnings.push({
        type: 'availability',
        title: 'Employee Unavailable',
        message: `This employee marked ${dayName} as unavailable.`,
      })
    } else if (!dayAvailability.startTime || !dayAvailability.endTime) {
      warnings.push({
        type: 'availability',
        title: 'Availability Hours Missing',
        message: `This employee does not have valid availability hours for ${dayName}.`,
      })
    } else {
      const availabilityStart = timeToMinutes(dayAvailability.startTime)

      const availabilityEnd = timeToMinutes(dayAvailability.endTime)

      if (startMinutes < availabilityStart || endMinutes > availabilityEnd) {
        warnings.push({
          type: 'availability',
          title: 'Outside Employee Availability',
          message: `This employee is available on ${dayName} from ${dayAvailability.startTime} to ${dayAvailability.endTime}, but this shift is ${startTime} to ${endTime}.`,
          availability: {
            day: dayName,
            startTime: dayAvailability.startTime,
            endTime: dayAvailability.endTime,
          },
        })
      }
    }
  }

  // ========================================================
  // APPROVED TIME OFF
  // ========================================================

  const approvedTimeOff = await TimeOffRequest.find({
    employeeId,
    date,
    status: 'Approved',
  })

  for (const request of approvedTimeOff) {
    // ======================================================
    // ALL DAY
    // ======================================================

    if (request.allDay) {
      warnings.push({
        type: 'timeOff',
        title: 'Approved Time Off Conflict',
        message: `This employee has approved time off for all of ${dayName}.`,
        timeOff: {
          allDay: true,
          date,
        },
      })

      continue
    }

    // ======================================================
    // PARTIAL DAY
    // ======================================================

    if (request.startTime && request.endTime) {
      const timeOffStart = timeToMinutes(request.startTime)

      const timeOffEnd = timeToMinutes(request.endTime)

      const conflictsWithTimeOff =
        startMinutes < timeOffEnd && endMinutes > timeOffStart

      if (conflictsWithTimeOff) {
        warnings.push({
          type: 'timeOff',
          title: 'Approved Time Off Conflict',
          message: `This employee has approved time off from ${request.startTime} to ${request.endTime}. The requested shift overlaps that time.`,
          timeOff: {
            allDay: false,
            date,
            startTime: request.startTime,
            endTime: request.endTime,
          },
        })
      }
    }
  }

  // ========================================================
  // WARNINGS EXIST AND ADMIN HAS NOT CONFIRMED
  // ========================================================

  if (warnings.length > 0 && !override) {
    return {
      valid: false,
      requiresOverride: true,
      warnings,
      message:
        warnings.length === 1
          ? warnings[0].message
          : 'This shift has scheduling conflicts that require manager confirmation.',
    }
  }

  // ========================================================
  // VALID
  //
  // Either:
  // - there were no warnings
  // OR
  // - the admin explicitly confirmed override
  // ========================================================

  return {
    valid: true,
    employee,
    overridden: override && warnings.length > 0,
    warnings,
  }
}

// ============================================================
// ADMIN
// MANUALLY ADD SHIFT
// ============================================================

router.post('/:scheduleId/shifts', auth, adminOnly, async (req, res) => {
  try {
    const {
      employeeId,
      date,
      startTime,
      endTime,
      assignedRole = '',
      override = false,
    } = req.body

    // ======================================================
    // REQUIRED FIELDS
    // ======================================================

    if (!employeeId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Employee, date, start time, and end time are required.',
      })
    }

    // ======================================================
    // FIND SCHEDULE
    // ======================================================

    const schedule = await Schedule.findById(req.params.scheduleId)

    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found.',
      })
    }

    // ======================================================
    // DRAFT ONLY
    // ======================================================

    if (schedule.status !== 'Draft') {
      return res.status(400).json({
        message: 'Published schedules cannot be edited.',
      })
    }

    // ======================================================
    // VALIDATE
    // ======================================================

    const validation = await validateManualShift({
      schedule,
      employeeId,
      date,
      startTime,
      endTime,
      override,
    })

    if (!validation.valid) {
      if (validation.requiresOverride) {
        return res.status(409).json({
          message: validation.message,
          requiresOverride: true,
          warnings: validation.warnings || [],
        })
      }

      return res.status(400).json({
        message: validation.message,
      })
    }

    // ======================================================
    // ADD SHIFT
    // ======================================================

    schedule.shifts.push({
      employeeId,
      date,
      startTime,
      endTime,
      assignedRole,
    })

    await schedule.save()

    // ======================================================
    // POPULATE EMPLOYEE INFORMATION
    // ======================================================

    await schedule.populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    // ======================================================
    // RECALCULATE COVERAGE
    // ======================================================

    const coverageIssues = calculateCoverageIssues(schedule)

    // ======================================================
    // RESPONSE
    // ======================================================

    res.status(201).json({
      message: 'Shift added successfully.',

      schedule,

      coverageIssues,
    })
  } catch (error) {
    console.error('Add shift error:', error)

    res.status(500).json({
      message: 'Unable to add shift.',
    })
  }
})

// ============================================================
// ADMIN
// MANUALLY EDIT SHIFT
// ============================================================

router.put(
  '/:scheduleId/shifts/:shiftId',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        employeeId,
        date,
        startTime,
        endTime,
        assignedRole = '',
        override = false,
      } = req.body

      // ======================================================
      // REQUIRED FIELDS
      // ======================================================

      if (!employeeId || !date || !startTime || !endTime) {
        return res.status(400).json({
          message: 'Employee, date, start time, and end time are required.',
        })
      }

      // ======================================================
      // FIND SCHEDULE
      // ======================================================

      const schedule = await Schedule.findById(req.params.scheduleId)

      if (!schedule) {
        return res.status(404).json({
          message: 'Schedule not found.',
        })
      }

      // ======================================================
      // DRAFT ONLY
      // ======================================================

      if (schedule.status !== 'Draft') {
        return res.status(400).json({
          message: 'Published schedules cannot be edited.',
        })
      }

      // ======================================================
      // FIND SHIFT
      // ======================================================

      const shift = schedule.shifts.id(req.params.shiftId)

      if (!shift) {
        return res.status(404).json({
          message: 'Shift not found.',
        })
      }

      // ======================================================
      // VALIDATE
      // ======================================================

      const validation = await validateManualShift({
        schedule,
        employeeId,
        date,
        startTime,
        endTime,
        ignoreShiftId: shift._id,
        override,
      })

      // ======================================================
      // HANDLE VALIDATION RESULT
      // ======================================================

      if (!validation.valid) {
        // Availability or approved time-off conflict.
        // The admin is allowed to override this.
        if (validation.requiresOverride) {
          return res.status(409).json({
            message: validation.message,
            requiresOverride: true,
            warnings: validation.warnings || [],
          })
        }

        // Hard validation error.
        // These cannot be overridden.
        return res.status(400).json({
          message: validation.message,
        })
      }

      // ======================================================
      // UPDATE SHIFT
      // ======================================================

      shift.employeeId = employeeId
      shift.date = date
      shift.startTime = startTime
      shift.endTime = endTime
      shift.assignedRole = assignedRole

      await schedule.save()

      // ======================================================
      // POPULATE
      // ======================================================

      await schedule.populate(
        'shifts.employeeId',
        'firstName lastName email roles maxWeeklyHours status',
      )

      // ======================================================
      // RECALCULATE COVERAGE
      // ======================================================

      const coverageIssues = calculateCoverageIssues(schedule)

      // ======================================================
      // RESPONSE
      // ======================================================

      res.json({
        message: validation.overridden
          ? 'Shift updated successfully with manager override.'
          : 'Shift updated successfully.',

        schedule,

        coverageIssues,

        overridden: validation.overridden || false,
      })
    } catch (error) {
      console.error('Edit shift error:', error)

      res.status(500).json({
        message: 'Unable to update shift.',
      })
    }
  },
)

// ============================================================
// ADMIN
// DELETE SHIFT
// ============================================================

router.delete(
  '/:scheduleId/shifts/:shiftId',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      // ======================================================
      // FIND SCHEDULE
      // ======================================================

      const schedule = await Schedule.findById(req.params.scheduleId)

      if (!schedule) {
        return res.status(404).json({
          message: 'Schedule not found.',
        })
      }

      // ======================================================
      // DRAFT ONLY
      // ======================================================

      if (schedule.status !== 'Draft') {
        return res.status(400).json({
          message: 'Published schedules cannot be edited.',
        })
      }

      // ======================================================
      // FIND SHIFT
      // ======================================================

      const shift = schedule.shifts.id(req.params.shiftId)

      if (!shift) {
        return res.status(404).json({
          message: 'Shift not found.',
        })
      }

      // ======================================================
      // DELETE
      // ======================================================

      shift.deleteOne()

      await schedule.save()

      // ======================================================
      // POPULATE
      // ======================================================

      await schedule.populate(
        'shifts.employeeId',
        'firstName lastName email roles maxWeeklyHours status',
      )

      // ======================================================
      // RECALCULATE COVERAGE
      // ======================================================

      const coverageIssues = calculateCoverageIssues(schedule)

      // ======================================================
      // RESPONSE
      // ======================================================

      res.json({
        message: 'Shift deleted successfully.',

        schedule,

        coverageIssues,
      })
    } catch (error) {
      console.error('Delete shift error:', error)

      res.status(500).json({
        message: 'Unable to delete shift.',
      })
    }
  },
)

// ============================================================
// ADMIN
// PUBLISH SCHEDULE
// ============================================================
//
// FINAL PUBLISH VALIDATION:
//
// 1. Schedule must exist.
// 2. Schedule must still be a Draft.
// 3. Schedule must contain at least one shift.
// 4. Every saved shift is checked against HARD rules.
// 5. Coverage is recalculated from the saved shifts.
// 6. Coverage problems require manager confirmation.
// 7. Coverage override does NOT bypass hard validation.
//
// First request:
//
// PATCH /api/schedules/:id/publish
// {
//   overrideWarnings: false
// }
//
// If coverage problems exist:
//
// HTTP 409
// {
//   requiresOverride: true,
//   warnings: [...]
// }
//
// Manager confirms:
//
// PATCH /api/schedules/:id/publish
// {
//   overrideWarnings: true
// }
//
// ============================================================

router.patch('/:id/publish', auth, adminOnly, async (req, res) => {
  try {
    const { overrideWarnings = false } = req.body || {}

    // ======================================================
    // FIND SCHEDULE
    // ======================================================

    const schedule = await Schedule.findById(req.params.id).populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found.',
      })
    }

    // ======================================================
    // DRAFT ONLY
    // ======================================================

    if (schedule.status !== 'Draft') {
      return res.status(400).json({
        message: 'Only draft schedules can be published.',
      })
    }

    // ======================================================
    // MUST HAVE SHIFTS
    // ======================================================

    if (!schedule.shifts || schedule.shifts.length === 0) {
      return res.status(400).json({
        message:
          'The schedule cannot be published because it does not contain any shifts.',
      })
    }

    // ======================================================
    // HARD VALIDATION
    //
    // These problems CANNOT be overridden.
    // ======================================================

    const hardErrors = []

    const employeeMinutesByWeek = new Map()
    const employeeMinutesByDay = new Map()
    const employeeShiftsByDay = new Map()

    const weekEnd = addDays(schedule.weekStart, 6)

    // ======================================================
    // VALIDATE EVERY SAVED SHIFT
    // ======================================================

    for (const shift of schedule.shifts) {
      const employee = shift.employeeId

      // ====================================================
      // EMPLOYEE MUST EXIST
      // ====================================================

      if (!employee || !employee._id) {
        hardErrors.push({
          type: 'employee',
          title: 'Employee Missing',
          message: `A shift on ${shift.date} is not linked to a valid employee.`,
          shiftId: shift._id,
        })

        continue
      }

      const employeeId = employee._id.toString()

      const employeeName =
        `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
        employee.email ||
        'Employee'

      // ====================================================
      // EMPLOYEE MUST BE ACTIVE
      // ====================================================

      if (employee.status !== 'Active') {
        hardErrors.push({
          type: 'employee',
          title: 'Inactive Employee',
          message: `${employeeName} is inactive but still has a scheduled shift on ${shift.date}.`,
          employeeId,
          shiftId: shift._id,
        })
      }

      // ====================================================
      // DATE MUST BE INSIDE WEEK
      // ====================================================

      if (shift.date < schedule.weekStart || shift.date > weekEnd) {
        hardErrors.push({
          type: 'date',
          title: 'Shift Outside Schedule Week',
          message: `${employeeName} has a shift on ${shift.date}, which is outside this schedule week.`,
          employeeId,
          shiftId: shift._id,
        })

        continue
      }

      // ====================================================
      // DETERMINE DAY
      // ====================================================

      const dayIndex = days.findIndex(
        (dayName, index) => addDays(schedule.weekStart, index) === shift.date,
      )

      if (dayIndex === -1) {
        hardErrors.push({
          type: 'date',
          title: 'Invalid Shift Date',
          message: `Unable to determine the day for ${employeeName}'s shift on ${shift.date}.`,
          employeeId,
          shiftId: shift._id,
        })

        continue
      }

      const dayName = days[dayIndex]

      // ====================================================
      // VALID TIMES
      // ====================================================

      if (!shift.startTime || !shift.endTime) {
        hardErrors.push({
          type: 'time',
          title: 'Missing Shift Time',
          message: `${employeeName} has a shift on ${dayName} with a missing start or end time.`,
          employeeId,
          shiftId: shift._id,
        })

        continue
      }

      const startMinutes = timeToMinutes(shift.startTime)
      const endMinutes = timeToMinutes(shift.endTime)

      if (endMinutes <= startMinutes) {
        hardErrors.push({
          type: 'time',
          title: 'Invalid Shift Time',
          message: `${employeeName} has an invalid shift on ${dayName}: ${shift.startTime} to ${shift.endTime}.`,
          employeeId,
          shiftId: shift._id,
        })

        continue
      }

      const duration = endMinutes - startMinutes

      // ====================================================
      // STORE HOURS
      // ====================================================

      const storeOpen = timeToMinutes(schedulingHours[dayName].open)

      const storeClose = timeToMinutes(schedulingHours[dayName].close)

      if (startMinutes < storeOpen || endMinutes > storeClose) {
        hardErrors.push({
          type: 'storeHours',
          title: 'Shift Outside Store Hours',
          message: `${employeeName}'s ${dayName} shift (${shift.startTime} - ${shift.endTime}) is outside store hours (${schedulingHours[dayName].open} - ${schedulingHours[dayName].close}).`,
          employeeId,
          shiftId: shift._id,
        })
      }

      // ====================================================
      // SINGLE SHIFT > 8 HOURS
      // ====================================================

      if (duration > MAX_DAILY_MINUTES) {
        hardErrors.push({
          type: 'dailyHours',
          title: 'Shift Exceeds 8 Hours',
          message: `${employeeName}'s ${dayName} shift exceeds the 8-hour daily limit.`,
          employeeId,
          shiftId: shift._id,
        })
      }

      // ====================================================
      // TRACK DAILY HOURS
      // ====================================================

      const dailyKey = `${employeeId}-${shift.date}`

      employeeMinutesByDay.set(
        dailyKey,
        (employeeMinutesByDay.get(dailyKey) || 0) + duration,
      )

      // ====================================================
      // TRACK WEEKLY HOURS
      // ====================================================

      employeeMinutesByWeek.set(
        employeeId,
        (employeeMinutesByWeek.get(employeeId) || 0) + duration,
      )

      // ====================================================
      // TRACK SHIFTS FOR OVERLAP CHECK
      // ====================================================

      if (!employeeShiftsByDay.has(dailyKey)) {
        employeeShiftsByDay.set(dailyKey, [])
      }

      employeeShiftsByDay.get(dailyKey).push({
        shiftId: shift._id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        startMinutes,
        endMinutes,
        employeeName,
        employeeId,
        dayName,
      })
    }

    // ======================================================
    // DAILY TOTALS
    // ======================================================

    for (const [dailyKey, totalMinutes] of employeeMinutesByDay) {
      if (totalMinutes <= MAX_DAILY_MINUTES) {
        continue
      }

      const dayShifts = employeeShiftsByDay.get(dailyKey) || []

      const example = dayShifts[0]

      if (!example) {
        continue
      }

      hardErrors.push({
        type: 'dailyHours',
        title: 'Daily Hours Exceeded',
        message: `${example.employeeName} is scheduled for ${(
          totalMinutes / 60
        ).toFixed(1)} hours on ${example.dayName}. The maximum is 8 hours.`,
        employeeId: example.employeeId,
      })
    }

    // ======================================================
    // OVERLAPPING SHIFTS
    // ======================================================

    for (const dayShifts of employeeShiftsByDay.values()) {
      const sorted = [...dayShifts].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      )

      for (let index = 0; index < sorted.length - 1; index += 1) {
        const current = sorted[index]
        const next = sorted[index + 1]

        if (next.startMinutes < current.endMinutes) {
          hardErrors.push({
            type: 'overlap',
            title: 'Overlapping Shifts',
            message: `${current.employeeName} has overlapping shifts on ${current.dayName}: ${current.startTime} - ${current.endTime} and ${next.startTime} - ${next.endTime}.`,
            employeeId: current.employeeId,
            shiftIds: [current.shiftId, next.shiftId],
          })
        }
      }
    }

    // ======================================================
    // WEEKLY LIMITS
    // ======================================================

    const uniqueEmployees = new Map()

    schedule.shifts.forEach((shift) => {
      const employee = shift.employeeId

      if (employee?._id) {
        uniqueEmployees.set(employee._id.toString(), employee)
      }
    })

    for (const [employeeId, totalMinutes] of employeeMinutesByWeek) {
      const employee = uniqueEmployees.get(employeeId)

      if (!employee) {
        continue
      }

      const weeklyLimitHours = Math.min(employee.maxWeeklyHours || 40, 40)

      const weeklyLimitMinutes = weeklyLimitHours * 60

      if (totalMinutes > weeklyLimitMinutes) {
        const employeeName =
          `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
          employee.email ||
          'Employee'

        hardErrors.push({
          type: 'weeklyHours',
          title: 'Weekly Hours Exceeded',
          message: `${employeeName} is scheduled for ${(
            totalMinutes / 60
          ).toFixed(
            1,
          )} hours. Their weekly limit is ${weeklyLimitHours} hours.`,
          employeeId,
        })
      }
    }

    // ======================================================
    // HARD ERRORS BLOCK PUBLISHING
    // ======================================================

    if (hardErrors.length > 0) {
      return res.status(400).json({
        message:
          'The schedule cannot be published until the scheduling errors are fixed.',

        validationFailed: true,

        errors: hardErrors,
      })
    }

    // ======================================================
    // COVERAGE VALIDATION
    //
    // Coverage shortages are warnings.
    // Manager can explicitly confirm them.
    // ======================================================

    const coverageIssues = calculateCoverageIssues(schedule)

    // ======================================================
    // COVERAGE WARNINGS REQUIRE CONFIRMATION
    // ======================================================

    if (coverageIssues.length > 0 && !overrideWarnings) {
      const warnings = coverageIssues.map((issue) => ({
        type: 'coverage',

        title: 'Coverage Shortage',

        date: issue.date,

        day: issue.day,

        startTime: issue.startTime,

        endTime: issue.endTime,

        required: issue.required,

        scheduled: issue.scheduled,

        missing: issue.required - issue.scheduled,

        message:
          `${issue.day} ${issue.startTime} - ${issue.endTime}: ` +
          `${issue.scheduled} of ${issue.required} employees scheduled.`,
      }))

      return res.status(409).json({
        message:
          'This schedule still has coverage shortages. Review them before publishing.',

        requiresOverride: true,

        warningType: 'coverage',

        warnings,

        coverageIssues,
      })
    }

    // ======================================================
    // PUBLISH
    // ======================================================

    schedule.status = 'Published'
    schedule.publishedAt = new Date()

    await schedule.save()

    // ======================================================
    // POPULATE AFTER SAVE
    // ======================================================

    await schedule.populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    // ======================================================
    // RESPONSE
    // ======================================================

    res.json({
      message:
        coverageIssues.length > 0
          ? 'Schedule published successfully with manager-confirmed coverage shortages.'
          : 'Schedule published successfully.',

      schedule,

      coverageIssues,

      publishedWithWarnings: coverageIssues.length > 0,
    })
  } catch (error) {
    console.error('Publish schedule error:', error)

    res.status(500).json({
      message: 'Unable to publish schedule.',
    })
  }
})
// ============================================================
// ADMIN
// GET PUBLISHED SCHEDULE FOR WEEK
// ============================================================

router.get('/published/week/:weekStart', auth, adminOnly, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      weekStart: req.params.weekStart,

      status: 'Published',
    }).populate(
      'shifts.employeeId',
      'firstName lastName email roles maxWeeklyHours status',
    )

    if (!schedule) {
      return res.status(404).json({
        message: 'No published schedule found for this week.',
      })
    }

    res.json({
      schedule,
    })
  } catch (error) {
    console.error('Get published schedule error:', error)

    res.status(500).json({
      message: 'Unable to retrieve published schedule.',
    })
  }
})
// ============================================================
// EMPLOYEE
// GET MY PUBLISHED SCHEDULE
// ============================================================

router.get('/my/week/:weekStart', auth, async (req, res) => {
  try {
    // ======================================================
    // EMPLOYEE ACCOUNT ONLY
    // ======================================================

    if (req.user.role !== 'employee') {
      return res.status(403).json({
        message: 'Employee access required.',
      })
    }

    // ======================================================
    // MUST BE LINKED TO EMPLOYEE
    // ======================================================

    if (!req.user.employeeId) {
      return res.status(400).json({
        message: 'No employee profile is linked to this account.',
      })
    }

    // ======================================================
    // ONLY PUBLISHED SCHEDULES
    // ======================================================

    const schedule = await Schedule.findOne({
      weekStart: req.params.weekStart,

      status: 'Published',
    }).populate('shifts.employeeId', 'firstName lastName email')

    if (!schedule) {
      return res.status(404).json({
        message: 'No published schedule found for this week.',
      })
    }

    // ======================================================
    // ONLY THIS EMPLOYEE'S SHIFTS
    // ======================================================

    const myShifts = schedule.shifts.filter(
      (shift) =>
        shift.employeeId &&
        shift.employeeId._id.toString() === req.user.employeeId.toString(),
    )

    // ======================================================
    // RESPONSE
    // ======================================================

    res.json({
      _id: schedule._id,

      weekStart: schedule.weekStart,

      status: schedule.status,

      publishedAt: schedule.publishedAt,

      shifts: myShifts,
    })
  } catch (error) {
    console.error('Employee schedule error:', error)

    res.status(500).json({
      message: 'Unable to retrieve your schedule.',
    })
  }
})

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router
