const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()

// ================================
// MIDDLEWARE
// ================================

app.use(cors())

app.use(express.json())

// ================================
// ROUTES
// ================================

const employeeRoutes = require('./routes/employees')
const availabilityRoutes = require('./routes/availability')
const authRoutes = require('./routes/auth')
const timeOffRequestRoutes = require('./routes/timeOffRequests')
const scheduleRoutes = require('./routes/schedules')

console.log('employeeRoutes:', typeof employeeRoutes)
console.log('availabilityRoutes:', typeof availabilityRoutes)
console.log('authRoutes:', typeof authRoutes)

app.use('/api/employees', employeeRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/time-off-requests', timeOffRequestRoutes)
app.use('/api/schedules', scheduleRoutes)
// Test route

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Qahwah House Scheduling API is running',
  })
})

// ================================
// DATABASE + SERVER
// ================================

const PORT = process.env.PORT || 5001

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully')

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('MongoDB connection error:')
    console.error(error.message)
  })
