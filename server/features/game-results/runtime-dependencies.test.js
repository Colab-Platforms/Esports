const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const compression = require('compression');
const multer = require('multer');

test('patched compression and multipart parsing preserve responses, uploads and limits', async () => {
  const app = express();
  const content = 'competitive result '.repeat(1000);
  app.use(compression());
  app.get('/results', (req, res) => res.json({ content }));
  app.post('/upload', multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 } }).single('proof'), (req, res) => {
    res.json({ name: req.file.originalname, content: req.file.buffer.toString() });
  });
  app.use((error, req, res, next) => res.status(400).json({ code: error.code }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const compressed = await fetch(`${base}/results`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(compressed.headers.get('content-encoding'), 'gzip');
    assert.deepEqual(await compressed.json(), { content });
    const upload = async value => {
      const body = new FormData();
      body.append('proof', new Blob([value]), 'score.txt');
      return fetch(`${base}/upload`, { method: 'POST', body });
    };
    const accepted = await upload('result');
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { name: 'score.txt', content: 'result' });
    const rejected = await upload('too many bytes');
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).code, 'LIMIT_FILE_SIZE');
    // Malformed multipart must return an error without bringing down the server.
    const malformed = await fetch(`${base}/upload`, {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' }, body: 'invalid'
    });
    assert.equal(malformed.status, 400);
    assert.equal((await fetch(`${base}/results`)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
