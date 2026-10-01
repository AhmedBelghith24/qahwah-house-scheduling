const { spawn } = require('child_process')
const path = require('path')

// ============================================================
// ENVIRONMENT
// ============================================================

const isVercel = process.env.VERCEL === '1'

// ============================================================
// LOCAL PYTHON OPTIMIZER
// ============================================================

const runLocalOptimizer = (schedulingData) => {
  return new Promise((resolve, reject) => {
    const optimizerDirectory = path.join(__dirname, '..', '..', 'optimizer')

    const pythonPath = path.join(optimizerDirectory, 'venv', 'bin', 'python3')

    const optimizerPath = path.join(optimizerDirectory, 'optimizer.py')

    const python = spawn(pythonPath, [optimizerPath], {
      cwd: optimizerDirectory,
    })

    let output = ''
    let errorOutput = ''

    python.stdout.on('data', (data) => {
      output += data.toString()
    })

    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    python.on('error', (error) => {
      console.error('Unable to start local optimizer:', error)

      reject(new Error('Unable to start schedule optimizer.'))
    })

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Local optimizer process failed.')

        console.error(errorOutput || output)

        return reject(new Error('Schedule optimizer failed.'))
      }

      try {
        const result = JSON.parse(output)

        if (!result.success) {
          return reject(
            new Error(
              result.message || 'Optimizer could not generate a schedule.',
            ),
          )
        }

        resolve(result)
      } catch (error) {
        console.error('Invalid optimizer output:', output)

        reject(new Error('Optimizer returned invalid JSON.'))
      }
    })

    try {
      python.stdin.write(JSON.stringify(schedulingData))

      python.stdin.end()
    } catch (error) {
      reject(error)
    }
  })
}

// ============================================================
// VERCEL PYTHON OPTIMIZER
// ============================================================

const runVercelOptimizer = async (schedulingData) => {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.APP_URL

  if (!baseUrl) {
    throw new Error('Production application URL is not configured.')
  }

  const response = await fetch(`${baseUrl}/api/optimizer`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(schedulingData),
  })

  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('Optimizer returned an invalid response.')
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Schedule optimizer failed.')
  }

  return result
}

// ============================================================
// MAIN OPTIMIZER SERVICE
// ============================================================

const runScheduleOptimizer = async (schedulingData) => {
  if (isVercel) {
    return runVercelOptimizer(schedulingData)
  }

  return runLocalOptimizer(schedulingData)
}

module.exports = {
  runScheduleOptimizer,
}
