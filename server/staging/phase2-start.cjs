'use strict';

// Opt-in entrypoint for the isolated Esports-dev validation window only.
require('./phase2-safety').prepare()
  .then(() => require('../index'))
  .catch(async () => {
    process.stderr.write('Phase 2 staging startup rejected; verify target, credentials and isolation settings.\n');
    await require('mongoose').disconnect().catch(() => {});
    process.exitCode = 1;
  });
