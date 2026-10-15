const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const collect = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? collect(file) : file.endsWith('.test.js') ? [file] : [];
});

// Tests cannot inherit application database URIs, OAuth keys or delivery credentials.
const env = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(path|systemroot|windir|comspec|temp|tmp|pathext|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programdata|systemdrive|MONGOMS_SYSTEM_BINARY|MONGOMS_DOWNLOAD_DIR)$/i.test(key)) env[key] = value;
}
Object.assign(env, { NODE_ENV: 'test', REDIS_DISABLED: 'true', MONGOMS_VERSION: '8.2.6' });
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...collect(path.join(root, 'server/features'))], {
  cwd: root, env, stdio: 'inherit'
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status === null ? 1 : result.status;
