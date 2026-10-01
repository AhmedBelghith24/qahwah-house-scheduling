const express = require('express')
const router = express.Router()

const TimeOffRequest = require('../models/TimeOffRequest')
const Employee = require('../models/Employee')

const { auth, adminOnly } = require('../middleware/auth')

// ======================================================
// GET ALL TIME-OFF REQUESTS - ADMIN ONLY
// ======================================================

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const requests = await TimeOffRequest.find()
      .populate('employeeId', 'firstName lastName email roles status')
      .sort({
        date: -1,
        createdAt: -1,
      })

    res.json(requests)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve time-off requests.',
    })
  }
})

// ======================================================
// GET PENDING TIME-OFF REQUEST COUNT - ADMIN ONLY
// ======================================================

router.get('/pending/count', auth, adminOnly, async (req, res) => {
  try {
    const count = await TimeOffRequest.countDocuments({
      status: 'Pending',
    })

    res.json({
      count,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve pending request count.',
    })
  }
})

// ======================================================
// GET MY TIME-OFF REQUESTS - EMPLOYEE ONLY
// ======================================================

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

    const requests = await TimeOffRequest.find({
      employeeId: req.user.employeeId,
    }).sort({
      date: -1,
      createdAt: -1,
    })

    res.json(requests)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve your time-off requests.',
    })
  }
})

// ======================================================
// CREATE TIME-OFF REQUEST - EMPLOYEE ONLY
// ======================================================

router.post('/me', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        message: 'Employee access required.',
      })
    }

    const employeeId = req.user.employeeId

    const { date, allDay, startTime, endTime, reason } = req.body

    if (!employeeId) {
      return res.status(400).json({
        message: 'No employee profile is linked to this account.',
      })
    }

    if (!date) {
      return res.status(400).json({
        message: 'Please select a date.',
      })
    }

    // Partial-day requests need
    // both a start and end time.
    if (!allDay) {
      if (!startTime || !endTime) {
        return res.status(400).json({
          message:
            'Start and end times are required for a partial-day request.',
        })
      }

      if (startTime >= endTime) {
        return res.status(400).json({
          message: 'End time must be after start time.',
        })
      }
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

    const request = new TimeOffRequest({
      employeeId,
      date,

      allDay: allDay === undefined ? true : allDay,

      startTime: allDay ? '' : startTime,

      endTime: allDay ? '' : endTime,

      reason: reason?.trim() || '',

      status: 'Pending',
    })

    await request.save()

    res.status(201).json(request)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to submit time-off request.',
    })
  }
})

// ======================================================
// CANCEL MY PENDING REQUEST - EMPLOYEE ONLY
// ======================================================

router.delete('/me/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        message: 'Employee access required.',
      })
    }

    const request = await TimeOffRequest.findOne({
      _id: req.params.id,
      employeeId: req.user.employeeId,
    })

    if (!request) {
      return res.status(404).json({
        message: 'Time-off request not found.',
      })
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        message: 'Only pending requests can be cancelled.',
      })
    }

    await request.deleteOne()

    res.json({
      message: 'Time-off request cancelled successfully.',
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to cancel time-off request.',
    })
  }
})

// ======================================================
// APPROVE / DENY REQUEST - ADMIN ONLY
// ======================================================

router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body

    if (!['Approved', 'Denied'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be Approved or Denied.',
      })
    }

    const request = await TimeOffRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate('employeeId', 'firstName lastName email roles status')

    if (!request) {
      return res.status(404).json({
        message: 'Time-off request not found.',
      })
    }

    res.json(request)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to update time-off request.',
    })
  }
})

module.exports = router
