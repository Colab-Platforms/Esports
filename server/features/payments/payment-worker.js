// Bounded reconciliation only. Never starts receipt delivery or issues refunds.
let timer;
let running = false;
function start() {
  if (process.env.VALORANT_PAYMENT_WORKER_ENABLED !== 'true' || !require('../../config/paymentFeatures').enabled() || timer) return;
  const scan = async () => {
    if (running || require('mongoose').connection.readyState !== 1) return;
    running = true;
    try { await require('./payment.service').reconcile(); }
    catch { console.warn('VALORANT_PAYMENT_RECONCILIATION_FAILED'); }
    finally { running = false; }
  };
  timer = setInterval(scan, 60000); timer.unref();
}
function stop() { clearInterval(timer); timer = undefined; }
module.exports = { start, stop };
