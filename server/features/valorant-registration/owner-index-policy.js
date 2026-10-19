// Missing/null marker includes every historical row and legacy game registration.
// Only the dedicated server-owned Valorant creation paths set the marker.
const flow = 'valorant_v1';
const ownerKey = { tournamentId: 1, userId: 1 };
const legacy = { name: 'uniq_legacy_registration_owner', key: ownerKey, unique: true,
  partialFilterExpression: { registrationFlow: null } };
const active = { name: 'uniq_active_valorant_registration_owner', key: ownerKey, unique: true,
  partialFilterExpression: { registrationFlow: flow, status: { $in: ['pending', 'images_uploaded', 'verified'] } } };
const isUnconditionalOwnerIndex = index => index.unique && !index.partialFilterExpression &&
  Object.keys(index.key).length === 2 && index.key.tournamentId === 1 && index.key.userId === 1;
module.exports = { flow, legacy, active, isUnconditionalOwnerIndex };
