const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('../models/User')
const Employee = require('../models/Employee')

const router = express.Router()

// ==========================================
// CREATE JWT
// ==========================================

const createToken = (user) => {
  const employeeId = user.employeeId?._id || user.employeeId || null

  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      employeeId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '3h',
    },
  )
}

// ==========================================
// EMPLOYEE ACCOUNT ACTIVATION
// POST /api/auth/activate
// ==========================================

router.post('/activate', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters.',
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Employee must already have been
    // created by an admin.
    const employee = await Employee.findOne({
      email: normalizedEmail,
    })

    if (!employee) {
      return res.status(404).json({
        message: 'No employee record was found for this email.',
      })
    }

    if (employee.status === 'Inactive') {
      return res.status(403).json({
        message: 'This employee account is inactive.',
      })
    }

    // Prevent activating the same account twice.
    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      return res.status(400).json({
        message: 'An account already exists for this email. Please sign in.',
      })
    }

    // Hash password before saving.
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role: 'employee',
      employeeId: employee._id,
    })

    await user.save()

    res.status(201).json({
      message: 'Account activated successfully. You can now sign in.',
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to activate account.',
    })
  }
})

// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const user = await User.findOne({
      email: normalizedEmail,
    }).populate('employeeId', 'firstName lastName email roles status')

    // Keep the same response for wrong email/password.
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    if (!user.active) {
      return res.status(403).json({
        message: 'This account is inactive.',
      })
    }

    // If employee, make sure employee
    // record is still active.
    if (
      user.role === 'employee' &&
      (!user.employeeId || user.employeeId.status === 'Inactive')
    ) {
      return res.status(403).json({
        message: 'This employee account is inactive.',
      })
    }

    const token = createToken(user)

    res.json({
      message: 'Login successful.',

      token,

      user: {
        id: user._id,
        email: user.email,
        role: user.role,

        employeeId: user.employeeId?._id || null,

        firstName: user.employeeId?.firstName || null,

        lastName: user.employeeId?.lastName || null,

        roles: user.employeeId?.roles || [],
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to login.',
    })
  }
})

module.exports = router
