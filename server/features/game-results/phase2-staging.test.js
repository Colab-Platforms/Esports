'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const safety = require('../../staging/phase2-safety');
const uri = 'mongodb+srv://colab_phase2_tester:synthetic-only@fixture.mongodb.net/colab-esports-phase2-test';

test('staging accepts only dedicated Atlas credentials, target and secure URI options', () => {
  assert.equal(safety.verifyTarget(uri).pathname, '/colab-esports-phase2-test');
  for (const invalid of [uri.replace('phase2-test', 'prod'), uri.replace('phase2-test', 'dev'), uri.replace('colab_phase2_tester:', 'other:'), uri.replace('mongodb+srv:', 'mongodb:'), uri + '?tls=false', uri + '?tlsAllowInvalidCertificates=true', uri + '?w=majority&w=1', uri + '?proxyHost=proxy']) {
    assert.throws(() => safety.verifyTarget(invalid), error => error.code.startsWith('STAGING_'));
  }
});

test('authorization fails closed on wrong identity, missing privileges and cross-database grants', () => {
  const info = { authenticatedUsers: [{ user: 'colab_phase2_tester' }], authenticatedUserRoles: [{ role: 'readWrite', db: 'colab-esports-phase2-test' }], authenticatedUserPrivileges: [{ resource: { db: 'colab-esports-phase2-test', collection: '' }, actions: ['find', 'insert', 'update', 'remove'] }] };
  assert.doesNotThrow(() => safety.verifyAuthorization('colab-esports-phase2-test', info));
  for (const change of [copy => { copy.authenticatedUsers[0].user = 'other'; }, copy => { copy.authenticatedUserRoles[0].db = 'admin'; }, copy => { copy.authenticatedUserPrivileges[0].resource.db = 'colab-esports-prod'; }, copy => { copy.authenticatedUserPrivileges[0].actions = ['find']; }, copy => { copy.authenticatedUserPrivileges = []; }]) {
    const copy = structuredClone(info); change(copy);
    assert.throws(() => safety.verifyAuthorization('colab-esports-phase2-test', copy), error => error.code.startsWith('STAGING_'));
  }
});

test('external transports are blocked and installing the network guard is reversible', () => {
  const net = require('node:net');
  const original = net.Socket.prototype.connect;
  const restore = safety.installNetworkGuard(new Map([['allowed.mongodb.net', 27017]]));
  try {
    assert.throws(() => net.createConnection({ host: 'example.org', port: 443 }), /STAGING_EXTERNAL_CONNECTION_BLOCKED/);
    assert.throws(() => net.createConnection({ host: 'allowed.mongodb.net', port: 443 }), /STAGING_EXTERNAL_CONNECTION_BLOCKED/);
    assert.throws(() => require('node:https').request('https://example.org'), /STAGING_PROVIDER_CALL_BLOCKED/);
    assert.throws(() => fetch('https://example.org'), /STAGING_PROVIDER_CALL_BLOCKED/);
  } finally { restore(); }
  assert.equal(net.Socket.prototype.connect, original);
});

test('request policy preserves competitive routes and blocks registration, providers and payment side effects', () => {
  const id = '64f000000000000000000001';
  for (const [method, url] of [['GET', '/api/explore'], ['GET', '/api/players/player/statistics'], ['GET', '/api/tournaments'], ['GET', '/api/teams'], ['POST', '/api/auth/login'], ['POST', '/api/freefire-results'], ['PUT', '/api/valorant-results/' + id], ['POST', '/api/admin/tournaments/' + id + '/final-results/publish'], ['POST', '/api/bgmi-matches/' + id + '/verify/' + id]]) assert.equal(safety.requestAllowed(method, url), true, url);
  for (const [method, url] of [['POST', '/api/bgmi-registration/' + id + '/register'], ['PUT', '/api/bgmi-registration/admin/' + id + '/status'], ['POST', '/api/whatsapp/send-message'], ['GET', '/api/auth/google'], ['GET', '/API/AUTH/GOOGLE'], ['POST', '/api/auth/send-email-otp'], ['GET', '/api/upload'], ['POST', '/api/store/buy/' + id], ['POST', '/api/admin/withdrawals/' + id + '/approve'], ['POST', '/api/bgmi-matches/' + id + '/screenshot'], ['POST', '/api/users/friend-request']]) assert.equal(safety.requestAllowed(method, url), false, url);
});

function preparedChild(mode) {
  const script = `
    const assert = require('node:assert/strict');
    const Module = require('node:module');
    const original = Module._load;
    const mode = ${JSON.stringify(mode)};
    if(mode==='bad-service') process.env.RENDER_SERVICE_NAME='Esports-prod';
    if(mode==='bad-uri') process.env.MONGODB_URI=process.env.MONGODB_URI.replace('phase2-test','prod');
    let connections = 0;
    const info = { authenticatedUsers:[{user:mode==='bad-auth'?'other':'colab_phase2_tester'}], authenticatedUserRoles:[{db:'colab-esports-phase2-test',role:'readWrite'}], authenticatedUserPrivileges:[{resource:{db:'colab-esports-phase2-test',collection:''},actions:['find','insert','update','remove']}] };
    const fake = { connection:{db:{databaseName:'colab-esports-phase2-test',command:async command=>command.ping?{ok:1}:{authInfo:info}}}, settings:{}, set(key,value){this.settings[key]=value;}, async connect(_uri,options){connections++;assert.equal(options.autoIndex,false);assert.equal(options.autoCreate,false);return this;} };
    Module._load = function(request){if(request==='mongoose')return fake;return original.apply(this,arguments);};
    const dns=require('node:dns').promises;
    dns.resolveSrv=async()=>[{name:'fixture.mongodb.net',port:27017}];
    dns.lookup=async()=>[{address:'127.0.0.1'}];
    const safety=require('./server/staging/phase2-safety');
    (async()=>{
      if(mode==='bad-service'||mode==='bad-uri'){await assert.rejects(safety.prepare(),error=>error.code.startsWith('STAGING_'));assert.equal(connections,0);assert.equal(safety.isReady(),false);return;}
      if(mode==='bad-auth'){await assert.rejects(safety.prepare(),/STAGING_AUTHORIZATION_MISMATCH/);assert.equal(safety.isReady(),false);return;}
      await safety.prepare();assert.equal(safety.isReady(),true);assert.equal(connections,1);
      assert.equal(fake.settings.autoIndex,false);assert.equal(fake.settings.autoCreate,false);
      assert.equal(process.env.REDIS_DISABLED,'true');
      assert.equal(process.env.RAZORPAY_KEY_ID,undefined);assert.equal(process.env.RESEND_API_KEY,undefined);
      assert.deepEqual(require('dotenv').config(),{parsed:{}});
      await fake.connect(process.env.MONGODB_URI);assert.equal(connections,1);
      await assert.rejects(fake.connect(process.env.MONGODB_URI.replace('phase2-test','prod')),/STAGING_RECONNECT_BLOCKED/);
      const express=require('express');const app=express();safety.attach(app);
      const http=require('node:http');const server=http.createServer(app);
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      // Exercise the installed middleware directly without relaxing outbound isolation.
      const response={status:null,json(value){this.body=value;return this;},status(value){this.status=value;return this;}};
      const layer=app._router.stack.find(layer=>layer.handle.length===3 && layer.name==='<anonymous>');
      layer.handle({method:'POST',path:'/api/whatsapp/send-message'},response,()=>assert.fail('provider route passed'));
      assert.equal(response.status,503);
      await new Promise(resolve=>server.close(resolve));
    })().catch(error=>{process.stderr.write(error.code||error.message);process.exitCode=1;});
  `;
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (/^(path|systemroot|windir|comspec|temp|tmp|pathext|userprofile|localappdata|appdata)$/i.test(key)) env[key] = value;
  Object.assign(env, { PHASE2_STAGING: 'true', MONGODB_URI: uri, JWT_SECRET: 'synthetic-test-secret-at-least-32-characters', RAZORPAY_KEY_ID: 'synthetic', RESEND_API_KEY: 'synthetic' });
  return spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '../../..'), env, encoding: 'utf8', timeout: 15000 });
}

test('staging preparation gates readiness, clears provider keys and refuses reconnects', () => {
  const result = preparedChild('ready');
  assert.equal(result.status, 0, result.stderr);
});

test('staging preparation never becomes ready when authenticated ownership differs', () => {
  const result = preparedChild('bad-auth');
  assert.equal(result.status, 0, result.stderr);
});

test('staging rejects a production service or database URI before connecting', () => {
  for(const mode of ['bad-service','bad-uri']) {
    const result=preparedChild(mode);
    assert.equal(result.status,0,result.stderr);
  }
});

test('normal entrypoint cannot accidentally activate an unprepared staging mode', () => {
  const previous = process.env.PHASE2_STAGING;
  process.env.PHASE2_STAGING = 'true';
  try { assert.throws(() => safety.attach({ use() {} }), /STAGING_ENTRYPOINT_REQUIRED/); }
  finally { if (previous === undefined) delete process.env.PHASE2_STAGING; else process.env.PHASE2_STAGING = previous; }
  assert.equal(safety.isReady(), false);
});
