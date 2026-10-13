const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TournamentFeeError,
  assertTournamentFeeChangeAllowed,
  getTournamentFeeMinor,
  normalizeTournamentEntryFee,
  normalizeTournamentFeePayload
} = require('./tournament-fee.service');

test('normalizes free tournament fees to INR team-scope paise metadata', () => {
  assert.deepEqual(normalizeTournamentEntryFee(0), {
    entryFee: 0,
    entryFeeAmountMinor: 0,
    entryFeeCurrency: 'INR',
    entryFeeScope: 'team'
  });
});

test('normalizes valid non-zero INR tournament fees without trusting minor units', () => {
  assert.deepEqual(normalizeTournamentFeePayload({
    entryFee: '499',
    entryFeeAmountMinor: 1,
    entryFeeCurrency: 'USD',
    entryFeeScope: 'player'
  }), {
    entryFee: 499,
    entryFeeAmountMinor: 49900,
    entryFeeCurrency: 'INR',
    entryFeeScope: 'team'
  });
});

test('rejects missing, fractional, negative and out-of-range tournament fees', () => {
  assert.throws(() => normalizeTournamentEntryFee(undefined), /Entry fee is required/);
  assert.throws(() => normalizeTournamentEntryFee(10.5), /whole INR amount/);
  assert.throws(() => normalizeTournamentEntryFee(-1), /between 0 and 10000/);
  assert.throws(() => normalizeTournamentEntryFee(10001), /between 0 and 10000/);
});

test('reads legacy tournament fee metadata from entryFee when minor units are missing', () => {
  assert.equal(getTournamentFeeMinor({ entryFee: 125 }), 12500);
  assert.equal(getTournamentFeeMinor({ entryFee: 0 }), 0);
});

test('derives fee from positive legacy entryFee when stale minor units are zero', () => {
  assert.equal(getTournamentFeeMinor({
    entryFee: 550,
    entryFeeAmountMinor: 0
  }), 55000);
});

test('keeps positive minor-unit metadata authoritative when both values are present', () => {
  assert.equal(getTournamentFeeMinor({
    entryFee: 550,
    entryFeeAmountMinor: 50000
  }), 50000);
});

test('blocks fee changes after registration or intent activity begins', () => {
  const tournament = {
    entryFee: 0,
    entryFeeAmountMinor: 0,
    currentParticipants: 0
  };

  assert.doesNotThrow(() => assertTournamentFeeChangeAllowed({
    currentTournament: tournament,
    nextFeeMinor: 50000,
    registrationCount: 0,
    intentCount: 0
  }));

  assert.throws(() => assertTournamentFeeChangeAllowed({
    currentTournament: tournament,
    nextFeeMinor: 50000,
    registrationCount: 1,
    intentCount: 0
  }), TournamentFeeError);

  assert.throws(() => assertTournamentFeeChangeAllowed({
    currentTournament: { ...tournament, currentParticipants: 1 },
    nextFeeMinor: 50000,
    registrationCount: 0,
    intentCount: 0
  }), /cannot be changed/);
});

test('allows no-op fee updates even after activity', () => {
  assert.doesNotThrow(() => assertTournamentFeeChangeAllowed({
    currentTournament: {
      entryFee: 250,
      entryFeeAmountMinor: 25000,
      currentParticipants: 4
    },
    nextFeeMinor: 25000,
    registrationCount: 1,
    intentCount: 1
  }));
});
