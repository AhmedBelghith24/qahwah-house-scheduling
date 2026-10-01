const express = require('express')
const Employee = require('../models/Employee')

const { auth, adminOnly } = require('../middleware/auth')

const router = express.Router()

// Every employee-management endpoint requires
// a logged-in administrator
router.use(auth)
router.use(adminOnly)
// ================================
// GET ALL EMPLOYEES
// GET /api/employees
// ================================

router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({
      firstName: 1,
    })

    res.json(employees)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to retrieve employees.',
    })
  }
})

// ================================
// CREATE EMPLOYEE
// POST /api/employees
// ================================

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, roles, maxWeeklyHours } = req.body

    if (!firstName || !lastName || !email || !roles || roles.length === 0) {
      return res.status(400).json({
        message: 'Please complete all required fields.',
      })
    }

    const existingEmployee = await Employee.findOne({
      email: email.toLowerCase(),
    })

    if (existingEmployee) {
      return res.status(400).json({
        message: 'An employee with this email already exists.',
      })
    }

    const employee = new Employee({
      firstName,
      lastName,
      email,
      roles,
      maxWeeklyHours,
    })

    const savedEmployee = await employee.save()

    res.status(201).json(savedEmployee)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to create employee.',
    })
  }
})

// ================================
// UPDATE EMPLOYEE
// PUT /api/employees/:id
// ================================

router.put('/:id', async (req, res) => {
  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    )

    if (!updatedEmployee) {
      return res.status(404).json({
        message: 'Employee not found.',
      })
    }

    res.json(updatedEmployee)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to update employee.',
    })
  }
})

// ================================
// DELETE EMPLOYEE
// DELETE /api/employees/:id
// ================================

router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id)

    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found.',
      })
    }

    res.json({
      message: 'Employee deleted successfully.',
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to delete employee.',
    })
  }
})

module.exports = router
