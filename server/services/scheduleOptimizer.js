const { spawn } = require('child_process')
const path = require('path')

// ============================================================
// PATHS
// ============================================================

const optimizerDirectory = path.join(__dirname, '..', '..', 'optimizer')

const pythonPath = path.join(optimizerDirectory, 'venv', 'bin', 'python3')

const optimizerPath = path.join(optimizerDirectory, 'optimizer.py')

// ============================================================
// RUN PYTHON OR-TOOLS OPTIMIZER
// ============================================================

const runScheduleOptimizer = (schedulingData) => {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonPath, [optimizerPath], {
      cwd: optimizerDirectory,
    })

    let output = ''
    let errorOutput = ''

    // ======================================================
    // RECEIVE OUTPUT FROM PYTHON
    // ======================================================

    python.stdout.on('data', (data) => {
      output += data.toString()
    })

    // ======================================================
    // RECEIVE PYTHON ERRORS
    // ======================================================

    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    // ======================================================
    // PYTHON FAILED TO START
    // ======================================================

    python.on('error', (error) => {
      console.error('Unable to start optimizer:', error)

      reject(new Error('Unable to start schedule optimizer.'))
    })

    // ======================================================
    // PYTHON FINISHED
    // ======================================================

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Optimizer process failed.')

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

    // ======================================================
    // SEND SCHEDULING DATA TO PYTHON
    // ======================================================

    try {
      python.stdin.write(JSON.stringify(schedulingData))

      python.stdin.end()
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  runScheduleOptimizer,
}
