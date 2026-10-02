const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, createApp, resetDatabase, makeClient } = require('./helpers');

let c;

before(async () => {
  await resetDatabase();
  await db.col.users().deleteMany({});
  c = makeClient(createApp());
});

after(() => db.close());

describe('First start (bootstrapping the super admin)', () => {
  it('reports that setup is needed when there is no super admin', async () => {
    const res = await c.api.get('/api/auth/bootstrap');
    assert.deepEqual(res.body, { needed: true });
  });

  it('creates the super admin and signs them in', async () => {
    const res = await c.api.post('/api/auth/bootstrap')
      .send({ username: 'boss', email: 'boss@test.local', password: '123', birthdate: '1980-01-01' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'superAdmin');
    assert.ok(res.body.token);
  });

  it('does not offer setup again once the super admin exists', async () => {
    const status = await c.api.get('/api/auth/bootstrap');
    assert.deepEqual(status.body, { needed: false });
    const again = await c.api.post('/api/auth/bootstrap')
      .send({ username: 'boss2', email: 'boss2@test.local', password: '123', birthdate: '1980-01-01' });
    assert.equal(again.status, 409);
  });

  it('the new super admin can sign in normally', async () => {
    assert.ok(await c.login('boss', '123'));
  });
});