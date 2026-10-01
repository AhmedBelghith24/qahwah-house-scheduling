const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()

// ============================================================
// DATABASE
// ============================================================

let connectionPromise = null

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI)
      .then(() => {
        console.log('MongoDB connected successfully')
      })
      .catch((error) => {
        connectionPromise = null
        throw error
      })
  }

  return connectionPromise
}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors())
app.use(express.json())

// On Vercel, ensure MongoDB is connected
// before processing API requests.
if (process.env.VERCEL === '1') {
  app.use(async (req, res, next) => {
    try {
      await connectToDatabase()
      next()
    } catch (error) {
      console.error('MongoDB connection error:', error.message)

      res.status(500).json({
        message: 'Unable to connect to the database.',
      })
    }
  })
}

// ============================================================
// ROUTES
// ============================================================

const employeeRoutes = require('./routes/employees')
const availabilityRoutes = require('./routes/availability')
const authRoutes = require('./routes/auth')
const timeOffRequestRoutes = require('./routes/timeOffRequests')
const scheduleRoutes = require('./routes/schedules')

app.use('/api/employees', employeeRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/auth', authRoutes)

app.use('/api/time-off-requests', timeOffRequestRoutes)

app.use('/api/schedules', scheduleRoutes)

// ============================================================
// TEST ROUTE
// ============================================================

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Qahwah House Scheduling API is running',
  })
})

// ============================================================
// LOCAL SERVER
// ============================================================

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5001

  connectToDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
      })
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error.message)

      process.exit(1)
    })
}

// ============================================================
// VERCEL EXPORT
// ============================================================

module.exports = app
