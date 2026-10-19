'use strict';

const DB = 'colab-esports-phase2-test';
const USER = 'colab_phase2_tester';
// Esports-dev's platform service ID, confirmed from its Render Dashboard URL.
const RENDER_SERVICE_ID = 'srv-d62q0jffte5s73b9a7c0';
let ready = false;
let failureStage = 'ENVIRONMENT';
const reject = code => { throw Object.assign(new Error(code), { code }); };
// Never interpolate driver messages, stack traces, hosts or arbitrary codes.
const safeCodes = new Set([
  'STAGING_FLAG_REQUIRED', 'STAGING_SERVICE_ID_MISMATCH', 'STAGING_JWT_SECRET_REQUIRED',
  'STAGING_URI_INVALID', 'STAGING_TARGET_MISMATCH', 'STAGING_DUPLICATE_URI_OPTION',
  'STAGING_URI_OPTION_UNAPPROVED', 'STAGING_TLS_REQUIRED', 'STAGING_AUTH_MECHANISM_UNAPPROVED',
  'STAGING_SRV_UNVERIFIED', 'STAGING_AUTHORIZATION_MISMATCH', 'STAGING_PERMISSIONS_INSUFFICIENT',
  'STAGING_EXTERNAL_CONNECTION_BLOCKED', 'STAGING_PROVIDER_CALL_BLOCKED',
  'STAGING_RECONNECT_BLOCKED', 'STAGING_ENTRYPOINT_REQUIRED'
]);
function diagnosticCode(error) {
  const pending = [error], visited = new Set();
  let authentication = false, authorization = false, dns = false, network = false;
  while (pending.length && visited.size < 32) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (safeCodes.has(current.code)) return current.code;
    authentication ||= current.code === 18 || current.codeName === 'AuthenticationFailed';
    authorization ||= current.code === 13;
    dns ||= ['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'EAI_AGAIN', 'ETIMEOUT'].includes(current.code);
    network ||= ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH'].includes(current.code) ||
      ['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(current.name);
    pending.push(current.cause, current.reason);
    if (current.servers instanceof Map) for (const server of current.servers.values()) pending.push(server?.error);
  }
  if (authentication) return 'STAGING_AUTHENTICATION_FAILED';
  if (authorization) return 'STAGING_AUTHORIZATION_FAILED';
  if (dns) return 'STAGING_ATLAS_DNS_FAILED';
  if (network) return 'STAGING_ATLAS_NETWORK_FAILED';
  return {
    ENVIRONMENT: 'STAGING_ENVIRONMENT_FAILED', URI_VALIDATION: 'STAGING_URI_VALIDATION_FAILED',
    ATLAS_DNS: 'STAGING_ATLAS_DNS_FAILED', EXTERNAL_ISOLATION: 'STAGING_EXTERNAL_ISOLATION_FAILED',
    ATLAS_CONNECTION: 'STAGING_ATLAS_CONNECTION_FAILED', ATLAS_PING: 'STAGING_ATLAS_PING_FAILED',
    AUTHORIZATION: 'STAGING_AUTHORIZATION_FAILED', APPLICATION_LOADING: 'STAGING_APPLICATION_LOADING_FAILED'
  }[failureStage] || 'STAGING_STARTUP_FAILED';
}

function verifyTarget(uri) {
  let target;
  try { target = new URL(uri); } catch { reject('STAGING_URI_INVALID'); }
  if (target.protocol !== 'mongodb+srv:' || !target.hostname.endsWith('.mongodb.net') ||
      decodeURIComponent(target.pathname) !== '/' + DB ||
      decodeURIComponent(target.username) !== USER || !target.password) reject('STAGING_TARGET_MISMATCH');
  const seen = new Set();
  for (const [key, value] of target.searchParams) {
    const name = key.toLowerCase();
    if (seen.has(name)) reject('STAGING_DUPLICATE_URI_OPTION');
    seen.add(name);
    if (!['retrywrites', 'w', 'appname', 'authsource', 'authmechanism', 'tls', 'ssl', 'readpreference'].includes(name)) reject('STAGING_URI_OPTION_UNAPPROVED');
    if (['tls', 'ssl'].includes(name) && value.toLowerCase() !== 'true') reject('STAGING_TLS_REQUIRED');
    if (name === 'authmechanism' && !['SCRAM-SHA-256', 'SCRAM-SHA-1', 'DEFAULT'].includes(value.toUpperCase())) reject('STAGING_AUTH_MECHANISM_UNAPPROVED');
  }
  return target;
}

function verifyAuthorization(database, info) {
  if (database !== DB || info?.authenticatedUsers?.length !== 1 || info.authenticatedUsers[0].user !== USER ||
      !Array.isArray(info.authenticatedUserRoles) || !Array.isArray(info.authenticatedUserPrivileges) || !info.authenticatedUserPrivileges.length ||
      info.authenticatedUserRoles.some(role => role.db !== DB) ||
      info.authenticatedUserPrivileges.some(privilege => privilege.resource?.db !== DB || privilege.resource.cluster || privilege.resource.anyResource)) {
    reject('STAGING_AUTHORIZATION_MISMATCH');
  }
  const actions = new Set(info.authenticatedUserPrivileges.filter(privilege => privilege.resource.collection === '').flatMap(privilege => privilege.actions));
  if (!['find', 'insert', 'update', 'remove'].every(action => actions.has(action))) reject('STAGING_PERMISSIONS_INSUFFICIENT');
}

function installNetworkGuard(targets) {
  const net = require('node:net');
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const options = net._normalizeArgs(Array.isArray(args[0]) ? args[0] : args)[0];
    if (options.path || targets.get(options.host) !== Number(options.port)) reject('STAGING_EXTERNAL_CONNECTION_BLOCKED');
    return original.apply(this, args);
  };
  const restore = [() => { net.Socket.prototype.connect = original; }];
  for (const protocol of ['node:http', 'node:https', 'node:http2']) {
    const api = require(protocol);
    for (const key of ['request', 'get', 'connect']) {
      if (typeof api[key] !== 'function') continue;
      const previous = api[key];
      api[key] = () => reject('STAGING_PROVIDER_CALL_BLOCKED');
      restore.push(() => { api[key] = previous; });
    }
  }
  const fetch = global.fetch;
  global.fetch = () => reject('STAGING_PROVIDER_CALL_BLOCKED');
  restore.push(() => { global.fetch = fetch; });
  return () => restore.reverse().forEach(action => action());
}

function requestAllowed(method, path) {
  path = path.toLowerCase(); // Match Express's default case-insensitive routing.
  // OAuth, mail/debug and external integration reads are not smoke-test APIs.
  if (/^\/api\/(?:whatsapp|upload|bgmi-images|debug|wallet|store|referral)(?:\/|$)/.test(path)) return false;
  if (path.startsWith('/api/auth/') && !['/api/auth/login', '/api/auth/me', '/api/auth/profile'].includes(path)) return false;
  if (/steam|cloudinary|webhook/i.test(path)) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  if (method === 'POST' && path === '/api/auth/login') return true;
  if (method === 'PUT' && path === '/api/auth/profile') return true;
  if (method === 'POST' && /^\/api\/valorant-registration\/[a-f0-9]{24}\/(?:register|verify|reject|cancel)$/.test(path)) return true;
  if (['POST', 'PUT'].includes(method) && /^\/api\/(?:freefire-results|valorant-results)(?:\/[a-f0-9]{24}(?:\/(?:verify|void))?)?$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/admin\/tournaments\/[a-f0-9]{24}\/final-results\/(?:preview|publish|void)$/.test(path)) return true;
  return method === 'POST' && (path === '/api/bgmi-matches' || /^\/api\/bgmi-matches\/[a-f0-9]{24}\/(?:submit-result|verify\/[a-f0-9]{24})$/.test(path));
}

function attach(app) {
  if (process.env.PHASE2_STAGING === 'true' && !ready) reject('STAGING_ENTRYPOINT_REQUIRED');
  if (!ready) return;
  app.use((req, res, next) => {
    if (!requestAllowed(req.method, req.path.replace(/\/$/, ''))) return res.status(503).json({ success: false, error: { code: 'STAGING_OPERATION_DISABLED' } });
    next();
  });
  app.get('/api/phase2-readiness', (_req, res) => res.json({ ready: true, database: DB, scheduler: 'disabled', autoIndex: false, externalProviders: 'blocked' }));
}

async function prepare() {
  failureStage = 'ENVIRONMENT';
  if (process.env.PHASE2_STAGING !== 'true') reject('STAGING_FLAG_REQUIRED');
  if (process.env.RENDER_SERVICE_ID !== RENDER_SERVICE_ID) reject('STAGING_SERVICE_ID_MISMATCH');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) reject('STAGING_JWT_SECRET_REQUIRED');
  const uri = process.env.MONGODB_URI;
  failureStage = 'URI_VALIDATION';
  const target = verifyTarget(uri);
  failureStage = 'ATLAS_DNS';
  const dns = require('node:dns').promises;
  const servers = await dns.resolveSrv('_mongodb._tcp.' + target.hostname);
  if (!servers.length || servers.some(server => !server.name.endsWith('.mongodb.net') || server.port !== 27017)) reject('STAGING_SRV_UNVERIFIED');
  const targets = new Map();
  for (const server of servers) {
    targets.set(server.name, server.port);
    for (const address of await dns.lookup(server.name, { all: true })) targets.set(address.address, server.port);
  }
  failureStage = 'EXTERNAL_ISOLATION';
  installNetworkGuard(targets);
  // dotenv must not restore provider keys or replace the verified database URI.
  require('dotenv').config = () => ({ parsed: {} });
  for (const key of Object.keys(process.env)) if (/^(?:RAZORPAY_|UPSTASH_|WHATSAPP_|RESEND_|CLOUDINARY_|STEAM_|GOOGLE_|EMAIL_)/.test(key) || /^(?:HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$/i.test(key)) delete process.env[key];
  process.env.REDIS_DISABLED = 'true';
  const mongoose = require('mongoose');
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  failureStage = 'ATLAS_CONNECTION';
  await mongoose.connect(uri, { dbName: DB, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  failureStage = 'ATLAS_PING';
  await db.command({ ping: 1 });
  failureStage = 'AUTHORIZATION';
  verifyAuthorization(db.databaseName, (await db.command({ connectionStatus: 1, showPrivileges: true })).authInfo);
  // The unchanged entrypoint's connect call reuses this verified connection.
  mongoose.connect = async candidate => {
    if (candidate !== uri || mongoose.connection.db.databaseName !== DB) reject('STAGING_RECONNECT_BLOCKED');
    return mongoose;
  };
  ready = true;
  failureStage = 'APPLICATION_LOADING';
}

module.exports = { verifyTarget, verifyAuthorization, installNetworkGuard, requestAllowed, attach, prepare, diagnosticCode, isReady: () => ready };
