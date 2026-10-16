'use strict';

// Opt-in entrypoint for the isolated Esports-dev validation window only.
const safety = require('./phase2-safety');
let stopping = false;
async function stop(error) {
  if (stopping) return;
  stopping = true;
  process.stderr.write(safety.diagnosticCode(error) + '\n');
  process.exitCode = 1;
  const deadline = setTimeout(() => process.exit(1), 5000);
  deadline.unref();
  try { await require('mongoose').disconnect().catch(() => {}); }
  finally { process.exit(1); }
}
// Driver callbacks may fail outside the startup promise; never emit raw traces.
process.on('uncaughtException', stop);
process.on('unhandledRejection', stop);
safety.prepare().then(() => require('../index')).catch(stop);
