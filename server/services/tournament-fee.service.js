const MAX_TOURNAMENT_ENTRY_FEE_INR = 10000;

class TournamentFeeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'TournamentFeeError';
    this.code = code;
    this.status = status;
  }
}

const parseEntryFeeRupees = (entryFee) => {
  if (entryFee === undefined || entryFee === null || entryFee === '') {
    throw new TournamentFeeError('ENTRY_FEE_REQUIRED', 'Entry fee is required');
  }

  const amount = Number(entryFee);
  if (!Number.isFinite(amount)) {
    throw new TournamentFeeError('INVALID_ENTRY_FEE', 'Entry fee must be a valid INR amount');
  }

  if (amount < 0 || amount > MAX_TOURNAMENT_ENTRY_FEE_INR) {
    throw new TournamentFeeError(
      'ENTRY_FEE_OUT_OF_RANGE',
      `Entry fee must be between 0 and ${MAX_TOURNAMENT_ENTRY_FEE_INR}`
    );
  }

  if (!Number.isInteger(amount)) {
    throw new TournamentFeeError(
      'UNSUPPORTED_FRACTIONAL_ENTRY_FEE',
      'Entry fee must be a whole INR amount'
    );
  }

  return amount;
};

const normalizeTournamentEntryFee = (entryFee) => {
  const amount = parseEntryFeeRupees(entryFee);

  return {
    entryFee: amount,
    entryFeeAmountMinor: amount * 100,
    entryFeeCurrency: 'INR',
    entryFeeScope: 'team'
  };
};

const normalizeTournamentFeePayload = (payload = {}) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'entryFee')) {
    return {};
  }

  return normalizeTournamentEntryFee(payload.entryFee);
};

const getTournamentFeeMinor = (tournament = {}) => {
  if (tournament.entryFee === undefined || tournament.entryFee === null || tournament.entryFee === '') {
    return Number.isInteger(tournament.entryFeeAmountMinor) && tournament.entryFeeAmountMinor >= 0
      ? tournament.entryFeeAmountMinor
      : 0;
  }

  const legacyFeeMinor = normalizeTournamentEntryFee(tournament.entryFee).entryFeeAmountMinor;

  if (Number.isInteger(tournament.entryFeeAmountMinor) && tournament.entryFeeAmountMinor > 0) {
    return tournament.entryFeeAmountMinor;
  }

  return legacyFeeMinor;
};

const isTournamentFeeChangeLocked = ({ registrationCount = 0, intentCount = 0, currentParticipants = 0 } = {}) => (
  registrationCount > 0 || intentCount > 0 || currentParticipants > 0
);

const assertTournamentFeeChangeAllowed = ({
  currentTournament,
  nextFeeMinor,
  registrationCount = 0,
  intentCount = 0
}) => {
  const currentFeeMinor = getTournamentFeeMinor(currentTournament);
  if (currentFeeMinor === nextFeeMinor) {
    return;
  }

  if (isTournamentFeeChangeLocked({
    registrationCount,
    intentCount,
    currentParticipants: currentTournament?.currentParticipants || 0
  })) {
    throw new TournamentFeeError(
      'TOURNAMENT_FEE_LOCKED',
      'Entry fee cannot be changed after registration or payment intent activity begins',
      409
    );
  }
};

module.exports = {
  MAX_TOURNAMENT_ENTRY_FEE_INR,
  TournamentFeeError,
  assertTournamentFeeChangeAllowed,
  getTournamentFeeMinor,
  isTournamentFeeChangeLocked,
  normalizeTournamentEntryFee,
  normalizeTournamentFeePayload
};
