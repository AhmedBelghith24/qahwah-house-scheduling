import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Login from './pages/Login'
import ActivateAccount from './pages/ActivateAccount'

import ProtectedRoute from './components/ProtectedRoute'

// ADMIN
import AdminDashboard from './pages/admin/AdminDashboard'
import Employees from './pages/admin/Employees'
import WeeklySchedule from './pages/admin/WeeklySchedule'
import Availability from './pages/admin/Availability'
import Requests from './pages/admin/Requests'

// EMPLOYEE
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import MySchedule from './pages/employee/MySchedule'
import MyAvailability from './pages/employee/MyAvailability'
import TimeOffRequests from './pages/employee/TimeOffRequests'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ============================= */}
        {/* PUBLIC */}
        {/* ============================= */}

        <Route path="/" element={<Login />} />

        <Route path="/activate" element={<ActivateAccount />} />

        {/* ============================= */}
        {/* ADMIN */}
        {/* ============================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute allowedRole="admin">
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/schedule"
          element={
            <ProtectedRoute allowedRole="admin">
              <WeeklySchedule />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/availability"
          element={
            <ProtectedRoute allowedRole="admin">
              <Availability />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/requests"
          element={
            <ProtectedRoute allowedRole="admin">
              <Requests />
            </ProtectedRoute>
          }
        />

        {/* ============================= */}
        {/* EMPLOYEE */}
        {/* ============================= */}

        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRole="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/schedule"
          element={
            <ProtectedRoute allowedRole="employee">
              <MySchedule />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/availability"
          element={
            <ProtectedRoute allowedRole="employee">
              <MyAvailability />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/requests"
          element={
            <ProtectedRoute allowedRole="employee">
              <TimeOffRequests />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
