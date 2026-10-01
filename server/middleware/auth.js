const jwt = require('jsonwebtoken')

const auth = (req, res, next) => {
  try {
    const authorization = req.headers.authorization

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required.',
      })
    }

    const token = authorization.split(' ')[1]

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = decoded

    next()
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired authentication token.',
    })
  }
}

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access required.',
    })
  }

  next()
}

module.exports = {
  auth,
  adminOnly,
}
