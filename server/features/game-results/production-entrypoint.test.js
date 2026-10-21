const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

test('production entrypoint excludes discontinued CS2 writes and preserves neighboring APIs', { timeout: 90000 }, async () => {
  let replica, child, client;
  try {
    replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
    const uri = replica.getUri('competitive_startup_disposable');
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
    client = await new MongoClient(uri).connect();
    const tournaments = client.db().collection('tournaments');
    const tournament = { _id: new ObjectId(), name: 'Synthetic CS2 tournament', gameType: 'cs2', status: 'inactive' };
    await tournaments.insertOne(tournament);
    const player = { _id: new ObjectId(), username: 'synthetic-player', email: 'player@example.test',
      passwordHash: await bcrypt.hash('synthetic-password', 4), role: 'user', isActive: true,
      loginStreak: 0, lastLogin: new Date() };
    await client.db().collection('users').insertOne(player);
    const port = await new Promise(resolve => {
      const listener = net.createServer();
      listener.listen(0, '127.0.0.1', () => {
        const value = listener.address().port;
        listener.close(() => resolve(value));
      });
    });
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (/^(path|systemroot|windir|comspec|temp|tmp|pathext|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programdata|systemdrive)$/i.test(key)) env[key] = value;
    }
    Object.assign(env, {
      NODE_ENV: 'production', REDIS_DISABLED: 'true', MONGODB_URI: uri, PORT: String(port),
      JWT_SECRET: 'synthetic-entrypoint-secret', SESSION_SECRET: 'synthetic-entrypoint-session',
      CLIENT_URL: 'https://release.example.test', SERVER_URL: `http://127.0.0.1:${port}`,
      CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'synthetic', CLOUDINARY_API_SECRET: 'synthetic',
      GOOGLE_CLIENT_ID: 'synthetic', GOOGLE_CLIENT_SECRET: 'synthetic', STEAM_API_KEY: 'synthetic',
      STEAM_RETURN_URL: `http://127.0.0.1:${port}/api/auth/steam/return`, STEAM_REALM: `http://127.0.0.1:${port}/`
    });
    child = spawn(process.execPath, ['--require', path.join(__dirname, 'test-support/local-startup.cjs'), 'server/index.js'], {
      cwd: path.resolve(__dirname, '../../..'), env, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    for (let attempt = 0; attempt < 160 && !output.includes('MongoDB connected successfully'); attempt++) {
      assert.equal(child.exitCode, null, output);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.match(output, /MongoDB connected successfully/);
    const request = async (url, options) => {
      const response = await fetch(`http://127.0.0.1:${port}${url}`, { ...options, signal: AbortSignal.timeout(10000) });
      const body = await response.text();
      return { status: response.status, body };
    };
    for (const role of [null, 'user', 'designer', 'admin', 'moderator']) {
      const headers = { 'Content-Type': 'application/json' };
      if (role) headers.Authorization = `Bearer ${jwt.sign({ userId: new ObjectId().toString(), role }, env.JWT_SECRET)}`;
      // Both targeted and formerly dangerous bulk operations must be absent for every role.
      for (const body of [{ tournamentId: tournament._id.toString(), status: 'active' }, { status: 'active' }]) {
        assert.equal((await request('/api/admin/update-cs2-status', { method: 'POST', headers, body: JSON.stringify(body) })).status, 404, String(role));
      }
    }
    assert.deepEqual(await tournaments.findOne({ _id: tournament._id }), tournament);
    for (const url of ['/api/auth/login', '/api/auth/register']) {
      assert.equal((await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400, url);
    }
    const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: player.username, password: 'synthetic-password' }) });
    assert.equal(login.status, 200, login.body);
    const session = JSON.parse(login.body).data;
    assert.equal(session.user.id, player._id.toString());
    assert.equal((await request('/api/auth/profile', { headers: { Authorization: `Bearer ${session.token}` } })).status, 200);
    const dashboard = await request('/api/competition-dashboard', { headers: { Authorization: `Bearer ${session.token}` } });
    assert.equal(dashboard.status, 200, dashboard.body);
    assert.equal(JSON.parse(dashboard.body).data.player.id, player._id.toString());
    for (const [method, url] of [['POST', '/api/games'], ['PUT', '/api/games/synthetic'],
      ['DELETE', '/api/games/synthetic'], ['PATCH', '/api/games/synthetic/stats'], ['POST', '/api/games/admin/activate-all']]) {
      for (const [headers, expected] of [[{}, 401], [{ Authorization: `Bearer ${session.token}` }, 403]]) {
        assert.equal((await request(url, { method, headers: { 'Content-Type': 'application/json', ...headers },
          ...(method === 'DELETE' ? {} : { body: '{}' }) })).status, expected, `${method} ${url}`);
      }
    }
    for (const [url, status] of [
      ['/api/health', 200], ['/api/explore', 200], ['/api/games', 200],
      ['/api/admin/dashboard', 401], ['/api/competition-dashboard', 401], ['/api/bgmi-registration/my-registrations', 401],
      ['/api/freefire-registration/my-registrations', 401],
      ['/api/tournaments/results-directory?gameType=bgmi', 200], ['/api/leaderboards/bgmi', 200],
      ['/api/players/nobody/competitive-profile', 404], ['/api/teams/invalid/competitive-profile', 404],
      ['/api/registration-intents', 404], ['/api/payments', 404]
    ]) assert.equal((await request(url)).status, status, url);
    const handshake = await request('/socket.io/?EIO=4&transport=polling');
    assert.equal(handshake.status, 200);
    assert.match(handshake.body, /^0\{"sid":/);
    assert.doesNotMatch(output, /Cannot find module|Failed to load .*Registration routes|Startup test blocked external/);
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    if (client) await client.close();
    if (replica) await replica.stop();
  }
});
