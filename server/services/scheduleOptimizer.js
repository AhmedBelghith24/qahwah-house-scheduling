const { spawn } = require('child_process')
const path = require('path')

const isVercel = process.env.VERCEL === '1'

const runLocalOptimizer = (payload) => {
  return new Promise((resolve, reject) => {
    const optimizerDirectory = path.join(__dirname, '..', '..', 'optimizer')

    const pythonPath = path.join(optimizerDirectory, 'venv', 'bin', 'python3')

    const optimizerPath = path.join(optimizerDirectory, 'optimizer.py')

    const python = spawn(pythonPath, [optimizerPath], {
      cwd: optimizerDirectory,
    })

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('error', (error) => {
      reject(new Error(`Failed to start schedule optimizer: ${error.message}`))
    })

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Optimizer stderr:', stderr)

        return reject(
          new Error(stderr || `Schedule optimizer exited with code ${code}`),
        )
      }

      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (error) {
        console.error('Optimizer stdout:', stdout)
        console.error('Optimizer stderr:', stderr)

        reject(new Error('Schedule optimizer returned invalid JSON.'))
      }
    })

    python.stdin.write(JSON.stringify(payload))
    python.stdin.end()
  })
}

const runVercelOptimizer = async (payload) => {
  const optimizerUrl = process.env.OPTIMIZER_URL

  if (!optimizerUrl) {
    throw new Error('OPTIMIZER_URL service binding is not configured.')
  }

  const url = new URL('/optimize', optimizerUrl)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  let result

  try {
    result = await response.json()
  } catch (error) {
    throw new Error(
      `Optimizer returned an invalid response (${response.status}).`,
    )
  }

  if (!response.ok) {
    const message =
      result?.detail || result?.message || 'Schedule optimization failed.'

    throw new Error(message)
  }

  return result
}

const runScheduleOptimizer = async (payload) => {
  if (isVercel) {
    return runVercelOptimizer(payload)
  }

  return runLocalOptimizer(payload)
}

module.exports = {
  runScheduleOptimizer,
}
