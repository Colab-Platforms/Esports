const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');

const {
  assertNoBlockingReferences,
  assertNoMatchResultReverseDependencies,
  isCleanupAlreadyComplete,
  isEmptyLegacyRoster,
  verifyExpectedMatchResults
} = require('./cleanupLegacyValorantStagingData');

const oid = (id) => new ObjectId(id);

const makeExpectedMatchResults = () => [
  {
    _id: oid('6ab12eaa51f3ee2fb71d0ec9'),
    tournamentId: oid('6ab12ea951f3ee2fb71d0e78'),
    matchNumber: 9401,
    status: 'verified',
    teamA: {
      registrationId: oid('6ab12ea951f3ee2fb71d0e89'),
      teamNameSnapshot: 'Phase 4 Valorant A',
      score: 13
    },
    teamB: {
      registrationId: oid('6ab12eaa51f3ee2fb71d0e9a'),
      teamNameSnapshot: 'Phase 4 Valorant B',
      score: 8
    },
    winnerRegistrationId: oid('6ab12ea951f3ee2fb71d0e89')
  },
  {
    _id: oid('6ab37419c50955917dc23679'),
    tournamentId: oid('6ab37418c50955917dc23676'),
    matchNumber: 6,
    status: 'verified',
    teamA: {
      registrationId: oid('6ab37419c50955917dc23677'),
      teamNameSnapshot: 'Phase 6 Valorant A',
      score: 13
    },
    teamB: {
      registrationId: oid('6ab37419c50955917dc23678'),
      teamNameSnapshot: 'Phase 6 Valorant B',
      score: 8
    },
    winnerRegistrationId: oid('6ab37419c50955917dc23677')
  }
];

test('legacy cleanup roster validation accepts absent, null, and empty roster forms', () => {
  assert.equal(isEmptyLegacyRoster(undefined), true);
  assert.equal(isEmptyLegacyRoster(null), true);
  assert.equal(isEmptyLegacyRoster([]), true);
  assert.equal(isEmptyLegacyRoster({ length: 0, isMongooseDocumentArray: true }), true);
});

test('legacy cleanup roster validation rejects populated roster forms', () => {
  assert.equal(isEmptyLegacyRoster([{ userId: 'player-1' }]), false);
  assert.equal(isEmptyLegacyRoster({ 0: { userId: 'player-1' }, length: 1 }), false);
});

test('legacy cleanup allows only the expected two ValorantMatchResults', () => {
  assert.deepEqual(verifyExpectedMatchResults(makeExpectedMatchResults()).errors, []);
});

test('legacy cleanup rejects unexpected ValorantMatchResult IDs', () => {
  const results = makeExpectedMatchResults();
  results[0]._id = oid('6ab12eaa51f3ee2fb71d0eca');

  assert.match(verifyExpectedMatchResults(results).errors.join('\n'), /not allowlisted/);
});

test('legacy cleanup rejects expected ValorantMatchResult referencing unrelated registration', () => {
  const results = makeExpectedMatchResults();
  results[0].teamB.registrationId = oid('6ab12eaa51f3ee2fb71d0fff');

  assert.match(verifyExpectedMatchResults(results).errors.join('\n'), /outside the four allowlisted/);
});

test('legacy cleanup rejects expected ValorantMatchResult in wrong tournament', () => {
  const results = makeExpectedMatchResults();
  results[1].tournamentId = oid('6ab37418c50955917dc23600');

  assert.match(verifyExpectedMatchResults(results).errors.join('\n'), /tournamentId mismatch/);
});

test('legacy cleanup aborts on additional blocking registration dependencies', () => {
  assert.throws(
    () => assertNoBlockingReferences([
      {
        collection: 'tournamentfinalresults',
        count: 1,
        sampleIds: [oid('6ab37418c50955917dc23699')]
      }
    ]),
    /Blocking references/
  );
});

test('legacy cleanup aborts on ValorantMatchResult reverse dependencies', () => {
  assert.throws(
    () => assertNoMatchResultReverseDependencies([
      {
        collection: 'notifications',
        count: 1,
        sampleIds: [oid('6ab37418c50955917dc23698')]
      }
    ]),
    /reverse dependencies/
  );
});

test('legacy cleanup treats rerun with absent target match results as valid no-op input', () => {
  assert.equal(isCleanupAlreadyComplete([], []), true);
  assert.equal(isCleanupAlreadyComplete([{ _id: 'registration' }], []), false);
  assert.equal(isCleanupAlreadyComplete([], [{ _id: 'match-result' }]), false);
});
