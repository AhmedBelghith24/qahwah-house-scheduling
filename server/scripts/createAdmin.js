const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')

const User = require('../models/User')

dotenv.config()

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)

    console.log('MongoDB connected')

    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD

    if (!email || !password) {
      console.log('ADMIN_EMAIL and ADMIN_PASSWORD must be added to .env')

      await mongoose.connection.close()
      return
    }

    if (password.length < 8) {
      console.log('Admin password must be at least 8 characters.')

      await mongoose.connection.close()
      return
    }

    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      console.log('A user with this email already exists.')

      await mongoose.connection.close()
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const admin = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin',
      employeeId: null,
      active: true,
    })

    await admin.save()

    console.log('Admin account created successfully.')
    console.log(`Admin email: ${admin.email}`)

    await mongoose.connection.close()
  } catch (error) {
    console.error('Unable to create admin account:', error.message)

    await mongoose.connection.close()
  }
}

createAdmin()
