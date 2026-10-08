const assert = require('node:assert/strict');
const test = require('node:test');
const { validateLinkedTeamRegistration } = require('./tournament-registration-team-linking.service');

const ids = {
  team: '507f1f77bcf86cd799439011',
  user: '507f1f77bcf86cd799439012',
  otherUser: '507f1f77bcf86cd799439013'
};

const chainTeam = (team) => ({
  populate() { return this; },
  then(resolve) { return Promise.resolve(team).then(resolve); },
  catch(reject) { return Promise.resolve(team).catch(reject); }
});

const teamModel = (team) => ({
  findById: () => chainTeam(team)
});

const user = (id, gameIds = {}) => ({
  _id: id,
  gameIds,
  isActive: true
});

const linkedTeam = ({ game = 'freefire', captainId = ids.user } = {}) => ({
  _id: ids.team,
  game,
  isActive: true,
  captain: user(captainId, {
    freefire: { uid: 'ff-leader' },
    bgmi: { uid: 'bg-leader' }
  }),
  members: [
    {
      userId: user(captainId, {
        freefire: { uid: 'ff-leader' },
        bgmi: { uid: 'bg-leader' }
      })
    },
    {
      userId: user('507f1f77bcf86cd799439014', {
        freefire: { uid: 'ff-one' },
        bgmi: { uid: 'bg-one' }
      })
    },
    {
      userId: user('507f1f77bcf86cd799439015', {
        freefire: { uid: 'ff-two' },
        bgmi: { uid: 'bg-two' }
      })
    },
    {
      userId: user('507f1f77bcf86cd799439016', {
        freefire: { uid: 'ff-three' },
        bgmi: { uid: 'bg-three' }
      })
    }
  ],
  isMember(userId) {
    return this.members.some((member) => member.userId._id === userId);
  }
});

const freeFirePayload = {
  teamLeader: { freeFireId: 'ff-leader' },
  teamMembers: [{ freeFireId: 'ff-one' }, { freeFireId: 'ff-two' }, { freeFireId: 'ff-three' }]
};

const bgmiPayload = {
  teamLeader: { bgmiId: 'bg-leader' },
  teamMembers: [{ bgmiId: 'bg-one' }, { bgmiId: 'bg-two' }, { bgmiId: 'bg-three' }]
};

test('Free Fire existing Team registration validates and returns teamId for storage', async () => {
  const result = await validateLinkedTeamRegistration({
    Team: teamModel(linkedTeam()),
    teamId: ids.team,
    tournament: { gameType: 'freefire' },
    requesterUserId: ids.user,
    ...freeFirePayload
  });

  assert.equal(result.toString(), ids.team);
});

test('BGMI existing Team registration validates and returns teamId for storage', async () => {
  const result = await validateLinkedTeamRegistration({
    Team: teamModel(linkedTeam({ game: 'bgmi' })),
    teamId: ids.team,
    tournament: { gameType: 'bgmi' },
    requesterUserId: ids.user,
    ...bgmiPayload
  });

  assert.equal(result.toString(), ids.team);
});

test('ad-hoc registration without teamId is preserved', async () => {
  const result = await validateLinkedTeamRegistration({
    Team: teamModel(null),
    teamId: '',
    tournament: { gameType: 'freefire' },
    requesterUserId: ids.user,
    ...freeFirePayload
  });

  assert.equal(result, null);
});

test('invalid Team._id is rejected', async () => {
  await assert.rejects(
    () => validateLinkedTeamRegistration({
      Team: teamModel(null),
      teamId: 'not-a-team-id',
      tournament: { gameType: 'freefire' },
      requesterUserId: ids.user,
      ...freeFirePayload
    }),
    (error) => error.status === 400 && error.code === 'INVALID_TEAM_ID'
  );
});

test('wrong-game team is rejected', async () => {
  await assert.rejects(
    () => validateLinkedTeamRegistration({
      Team: teamModel(linkedTeam({ game: 'bgmi' })),
      teamId: ids.team,
      tournament: { gameType: 'freefire' },
      requesterUserId: ids.user,
      ...freeFirePayload
    }),
    (error) => error.status === 400 && error.code === 'INVALID_TEAM_GAME'
  );
});

test('unauthorized user cannot attach arbitrary team', async () => {
  await assert.rejects(
    () => validateLinkedTeamRegistration({
      Team: teamModel(linkedTeam()),
      teamId: ids.team,
      tournament: { gameType: 'freefire' },
      requesterUserId: ids.otherUser,
      ...freeFirePayload
    }),
    (error) => error.status === 403 && error.code === 'NOT_TEAM_MEMBER'
  );
});

test('submitted roster must belong to the selected Team', async () => {
  await assert.rejects(
    () => validateLinkedTeamRegistration({
      Team: teamModel(linkedTeam()),
      teamId: ids.team,
      tournament: { gameType: 'freefire' },
      requesterUserId: ids.user,
      teamLeader: { freeFireId: 'ff-leader' },
      teamMembers: [{ freeFireId: 'ff-one' }, { freeFireId: 'ff-two' }, { freeFireId: 'unrelated' }]
    }),
    (error) => error.status === 400 && error.code === 'TEAM_ROSTER_MISMATCH'
  );
});
