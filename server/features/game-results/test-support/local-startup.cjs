// Loaded only by the disposable full-entrypoint regression test.
// Never read a developer .env or permit an external service connection.
require('dotenv').config = () => ({ parsed: {} });
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = net._normalizeArgs(Array.isArray(args[0]) ? args[0] : args)[0];
  if (options.path || !['127.0.0.1', 'localhost', '::1'].includes(options.host || 'localhost')) {
    throw new Error('Startup test blocked external connection');
  }
  return connect.apply(this, args);
};
