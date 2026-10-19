const assert = require('node:assert/strict');
const test = require('node:test');

const { PROVIDERS, providers, isValidProvider } = require('../../config/providers.config');
const Identity = require('../../models/Identity');

test('auth provider registry excludes Riot and keeps existing providers', () => {
  assert.deepEqual(
    Object.values(PROVIDERS).sort(),
    ['facebook', 'google', 'steam', 'xbox']
  );
  assert.deepEqual(
    Object.keys(providers).sort(),
    ['facebook', 'google', 'steam', 'xbox']
  );

  assert.equal(isValidProvider('riot'), false);
  assert.equal(providers.riot, undefined);
});

test('Identity provider enum excludes Riot without changing existing providers', () => {
  const providerPath = Identity.schema.path('provider');
  assert.deepEqual(
    providerPath.enumValues.sort(),
    ['facebook', 'google', 'steam', 'xbox']
  );
  assert.equal(providerPath.enumValues.includes('riot'), false);
});

test('Identity indexes preserve generic uniqueness and have no Riot partial index', () => {
  const indexes = Identity.schema.indexes();

  assert.ok(
    indexes.some(([fields, options]) =>
      fields.provider === 1 &&
      fields.providerId === 1 &&
      options.unique === true
    )
  );

  assert.equal(
    indexes.some(([, options]) => options.partialFilterExpression?.provider === 'riot'),
    false
  );
});
