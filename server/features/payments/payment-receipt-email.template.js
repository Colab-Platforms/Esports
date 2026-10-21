const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatAmountInr = (amountMinor) => {
  const amount = Number(amountMinor || 0) / 100;
  return `INR ${amount.toFixed(2)}`;
};

const formatIstDate = (date) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(date ? new Date(date) : new Date());

const buildPaymentReceiptEmail = ({
  receipt,
  registration,
  tournament,
  captainName = 'Captain'
}) => {
  const paymentReference = receipt.gatewayPaymentId
    ? `${receipt.gateway}:${receipt.gatewayPaymentId}`
    : receipt.gateway;
  const amount = formatAmountInr(receipt.amountMinor);
  const paymentDate = formatIstDate(receipt.capturedAt);
  const tournamentName = tournament?.name || 'Valorant Tournament';
  const gameName = (tournament?.gameType || 'valorant').toUpperCase();
  const teamName = receipt.teamName || registration?.teamName || 'Your Team';
  const registrationStatus = { pending: 'Pending Admin Review', verified: 'Verified', rejected: 'Rejected' }[registration?.status] || 'See your registration for the latest status';
  const statement = registration?.status === 'pending'
    ? 'Payment received successfully. Your team registration is pending admin review. Payment confirmation does not guarantee approval.'
    : 'Payment received successfully. Check your registration for the latest review and refund status.';
  const subject = `Payment received - ${String(tournamentName).replace(/[\r\n]+/g, ' ')} registration`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0d0f12;color:#111;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;">
      <div style="background:#111827;color:#ffffff;padding:28px 32px;">
        <h1 style="margin:0;font-size:24px;">Colab Esports</h1>
        <p style="margin:8px 0 0;color:#cbd5e1;">Payment received</p>
      </div>
      <div style="padding:28px 32px;">
        <p>Hi ${escapeHtml(captainName)},</p>
        <p>${escapeHtml(statement)}</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Receipt number</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>${escapeHtml(receipt.receiptNumber)}</strong></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Tournament</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(tournamentName)}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Game</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(gameName)}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Team</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(teamName)}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Amount paid</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(amount)}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Payment date</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(paymentDate)} IST</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;">Payment reference</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(paymentReference)}</td></tr>
          <tr><td style="padding:10px;">Registration status</td><td style="padding:10px;"><strong>${escapeHtml(registrationStatus)}</strong></td></tr>
        </table>
        <p style="color:#475569;">This payment confirmation is not a GST tax invoice.</p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    'Colab Esports payment received',
    '',
    `Hi ${captainName},`,
    '',
    statement,
    '',
    `Receipt number: ${receipt.receiptNumber}`,
    `Tournament: ${tournamentName}`,
    `Game: ${gameName}`,
    `Team: ${teamName}`,
    `Amount paid: ${amount}`,
    `Payment date: ${paymentDate} IST`,
    `Payment reference: ${paymentReference}`,
    `Registration status: ${registrationStatus}`,
    '',
    'This payment confirmation is not a GST tax invoice.'
  ].join('\n');

  return { subject, html, text };
};

module.exports = {
  buildPaymentReceiptEmail,
  formatAmountInr,
  formatIstDate
};
