const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildAccounts,
  buildGames,
  normalizeTeam
} = require('./player-competitive-profile.service');

test('buildAccounts labels Riot as verified, Steam as linked, and legacy game IDs as saved IDs', () => {
  const user = {
    gameIds: {
      bgmi: { ign: 'Ace', uid: '12345' },
      freefire: { ign: '', uid: '' },
      steam: ''
    },
    steamProfile: { isConnected: false }
  };
  const identities = [
    {
      provider: 'riot',
      providerId: 'private-puuid',
      email: 'private@example.com',
      displayName: 'RiotUser#IN',
      profile: { gameName: 'RiotUser', tagLine: 'IN' }
    },
    {
      provider: 'steam',
      providerId: 'private-steam-id',
      email: '',
      displayName: 'SteamUser',
      profile: { profileUrl: 'https://steamcommunity.com/id/steam-user' }
    }
  ];

  const accounts = buildAccounts(user, identities);

  assert.deepEqual(
    accounts.map((account) => [account.provider, account.status, account.verificationStatus]),
    [
      ['riot', 'Verified', 'verified_game_identity'],
      ['steam', 'Linked', 'linked'],
      ['bgmi', 'Saved ID', 'unverified']
    ]
  );
  assert.equal(JSON.stringify(accounts).includes('private-puuid'), false);
  assert.equal(JSON.stringify(accounts).includes('private-steam-id'), false);
  assert.equal(JSON.stringify(accounts).includes('private@example.com'), false);
});

test('normalizeTeam recognizes captains stored outside the members array', () => {
  const team = {
    _id: 'team-a',
    name: 'Alpha',
    tag: 'ALP',
    logo: '',
    game: 'valorant',
    captain: 'user-a',
    members: [
      { userId: 'user-b', role: 'member', isSubstitute: false }
    ],
    maxMembers: 5,
    createdAt: new Date('2026-01-01T00:00:00Z')
  };

  const normalized = normalizeTeam(team, 'user-a');

  assert.equal(normalized.role, 'captain');
  assert.equal(normalized.rosterSize, 2);
  assert.equal(normalized.gameLabel, 'Valorant');
});

test('buildGames derives games only from player-specific signals', () => {
  const games = buildGames({
    user: { favoriteGame: '' },
    accounts: [{ game: 'valorant' }],
    teams: [{ game: 'bgmi' }],
    registrations: [{ tournamentId: { gameType: 'freefire' } }],
    participantTournaments: [{ gameType: 'cs2' }]
  });

  assert.deepEqual(
    games.map((game) => game.key).sort(),
    ['bgmi', 'cs2', 'freefire', 'valorant']
  );
});
