const { getTournamentFeeMinor } = require('./tournament-fee.service');

const createRegistrationError = (code, message, status = 400, extra = {}) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const getTournamentFeeAmountMinor = (tournament) => {
  if (!tournament) return 0;
  return getTournamentFeeMinor(tournament);
};

const isPaidValorantTournament = (tournament) => (
  tournament?.gameType === 'valorant' && getTournamentFeeAmountMinor(tournament) > 0
);

const assertDirectValorantRegistrationAllowed = (tournament) => {
  if (!isPaidValorantTournament(tournament)) return;
  throw createRegistrationError(
    'PAYMENT_REQUIRED',
    'Paid Valorant tournaments must use the registration intent payment flow',
    402,
    {
      amountMinor: getTournamentFeeAmountMinor(tournament),
      currency: tournament.entryFeeCurrency || 'INR',
      feeScope: tournament.entryFeeScope || 'team'
    }
  );
};

module.exports = {
  assertDirectValorantRegistrationAllowed,
  createRegistrationError,
  getTournamentFeeAmountMinor,
  isPaidValorantTournament
};
