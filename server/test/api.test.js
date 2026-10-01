const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, createApp, resetDatabase, makeClient } = require('./helpers');
const { deleteInactiveChannels } = require('../src/jobs');

let c; // test client
let superT, groupadmin, user1, user2, testuser1;
let group, general;

before(async () => {
  await resetDatabase();
  c = makeClient(createApp());
  superT = await c.login('super', '123');
  groupadmin = await c.register('groupadmin');
  user1 = await c.register('user1');
  user2 = await c.register('user2', '2012-06-01'); // under 18
  testuser1 = await c.register('testuser1');
});

after(() => db.close());

describe('Authentication', () => {
  it('registers a user without exposing the password hash', async () => {
    const res = await c.api.post('/api/auth/register')
      .send({ username: 'testuser2', email: 'testuser2@Test.local', password: 'secret', birthdate: '1999-03-03' });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'testuser2@test.local');
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it('rejects a duplicate email (email is the unique identifier)', async () => {
    const res = await c.api.post('/api/auth/register')
      .send({ username: 'testuser22', email: 'testuser2@test.local', password: 'secret', birthdate: '1999-03-03' });
    assert.equal(res.status, 409);
  });

  it('rejects invalid registration details', async () => {
    const res = await c.api.post('/api/auth/register')
      .send({ username: 'x', email: 'not-an-email', password: 'secret', birthdate: '1999-03-03' });
    assert.equal(res.status, 400);
  });

  it('signs in with username or email, and rejects a wrong password', async () => {
    assert.ok(await c.login('testuser2', 'secret'));
    assert.ok(await c.login('testuser2@test.local', 'secret'));
    const res = await c.api.post('/api/auth/login').send({ login: 'testuser2', password: 'wrong' });
    assert.equal(res.status, 401);
  });

  it('blocks protected routes without a token', async () => {
    const res = await c.api.get('/api/groups/mine');
    assert.equal(res.status, 401);
  });

  it('resets a forgotten password with a one-time link', async () => {
    const forgot = await c.api.post('/api/auth/forgot-password').send({ email: 'testuser2@test.local' });
    assert.equal(forgot.status, 200);
    const token = new URL(forgot.body.devResetUrl).searchParams.get('token');

    const reset = await c.api.post('/api/auth/reset-password').send({ token, password: 'newpass' });
    assert.equal(reset.status, 200);
    assert.equal(await c.login('testuser2', 'secret'), undefined);
    assert.ok(await c.login('testuser2', 'newpass'));

    const reuse = await c.api.post('/api/auth/reset-password').send({ token, password: 'again' });
    assert.equal(reuse.status, 400);
  });
});

describe('Permissions', () => {
  it('keeps regular users out of super admin routes', async () => {
    const res = await c.as(user1.token).get('/api/admin/users');
    assert.equal(res.status, 403);
  });

  it('keeps super admins out of group features (no direct contact with users)', async () => {
    const res = await c.as(superT).get('/api/groups/mine');
    assert.equal(res.status, 403);
  });

  it('only lets group admins request a new group', async () => {
    const res = await c.as(user1.token).post('/api/requests', { type: 'createGroup', name: 'Nope' });
    assert.equal(res.status, 403);
  });
});

describe('Groups are created by the super admin on request', () => {
  it('super admin makes groupadmin a group admin', async () => {
    const res = await c.as(superT).patch(`/api/admin/users/${groupadmin.user._id}/role`, { role: 'groupAdmin' });
    assert.equal(res.status, 200);
    groupadmin.token = await c.login('groupadmin', 'secret'); // fresh token is not required, but mirrors a real sign-in
  });

  it('groupadmin requests a group and the super admin approves it', async () => {
    const req = await c.as(groupadmin.token).post('/api/requests', { type: 'createGroup', name: 'Web Dev' });
    assert.equal(req.status, 201);

    const incoming = await c.as(superT).get('/api/requests/incoming');
    assert.equal(incoming.body.length, 1);

    const ok = await c.as(superT).post(`/api/requests/${req.body._id}/approve`);
    assert.equal(ok.status, 200);

    const mine = await c.as(groupadmin.token).get('/api/groups/mine');
    group = mine.body.find((g) => g.name === 'Web Dev');
    assert.ok(group);
    general = group.channels.find((ch) => ch.name === 'general');
    assert.ok(general, 'new groups start with a #general chatroom');
  });

  it('group admin can edit the name and theme', async () => {
    const res = await c.as(groupadmin.token).patch(`/api/groups/${group._id}`, { name: 'Web Development', theme: 'red' });
    assert.equal(res.status, 200);
    assert.equal(res.body.group.theme, 'red');
    assert.equal(res.body.group.name, 'Web Development');
  });

  it('rejects a theme outside red, yellow and blue', async () => {
    const res = await c.as(groupadmin.token).patch(`/api/groups/${group._id}`, { theme: 'green' });
    assert.equal(res.status, 400);
  });
});

describe('Joining groups', () => {
  it('a user asks to join and the group admin approves', async () => {
    const req = await c.as(user1.token).post('/api/requests', { type: 'joinGroup', groupId: group._id });
    assert.equal(req.status, 201);

    const dup = await c.as(user1.token).post('/api/requests', { type: 'joinGroup', groupId: group._id });
    assert.equal(dup.status, 409);

    const incoming = await c.as(groupadmin.token).get('/api/requests/incoming?type=joinGroup');
    assert.equal(incoming.body.length, 1);

    const notAdmin = await c.as(testuser1.token).post(`/api/requests/${req.body._id}/approve`);
    assert.equal(notAdmin.status, 403);

    const ok = await c.as(groupadmin.token).post(`/api/requests/${req.body._id}/approve`);
    assert.equal(ok.status, 200);

    const mine = await c.as(user1.token).get('/api/groups/mine');
    assert.equal(mine.body.length, 1);
  });

  it('testuser1 and user2 join too', async () => {
    for (const u of [testuser1, user2]) {
      const req = await c.as(u.token).post('/api/requests', { type: 'joinGroup', groupId: group._id });
      await c.as(groupadmin.token).post(`/api/requests/${req.body._id}/approve`);
    }
    const members = await c.as(groupadmin.token).get(`/api/groups/${group._id}/members`);
    assert.equal(members.body.current.length, 4);
  });
});

describe('Chatrooms', () => {
  let roomId;

  it('a member requests a chatroom and the admin approves it', async () => {
    const req = await c.as(user1.token).post('/api/requests', { type: 'createChannel', groupId: group._id, name: 'Project Ideas' });
    assert.equal(req.status, 201);
    assert.equal(req.body.name, 'project-ideas');
    await c.as(groupadmin.token).post(`/api/requests/${req.body._id}/approve`);

    const mine = await c.as(user1.token).get('/api/groups/mine');
    const room = mine.body[0].channels.find((ch) => ch.name === 'project-ideas');
    assert.ok(room);
    roomId = room._id;
  });

  it('a member requests chatroom deletion and the admin approves it', async () => {
    const req = await c.as(user1.token).post('/api/requests', { type: 'deleteChannel', groupId: group._id, channelId: roomId });
    assert.equal(req.status, 201);
    await c.as(groupadmin.token).post(`/api/requests/${req.body._id}/approve`);

    const mine = await c.as(user1.token).get('/api/groups/mine');
    assert.equal(mine.body[0].channels.some((ch) => ch._id === roomId), false);
  });

  it('a new member sees at most 3 messages from before they joined', async () => {
    const { col, toId } = db;
    const joinedAt = new Date(Date.now() - 60_000);
    // Pretend testuser2 joins now, with 5 older messages already in #general.
    const testuser2T = await c.login('testuser2', 'newpass');
    const testuser2 = (await c.as(testuser2T).get('/api/auth/me')).body;
    const old = [1, 2, 3, 4, 5].map((n) => ({
      channelId: toId(general._id), groupId: toId(group._id), userId: toId(user1.user._id), username: 'user1',
      text: `old ${n}`, imageUrl: null, createdAt: new Date(joinedAt.getTime() - (6 - n) * 1000),
    }));
    await col.messages().insertMany(old);
    await col.groups().updateOne(
      { _id: toId(group._id) },
      { $addToSet: { memberIds: toId(testuser2._id) }, $set: { [`memberSince.${testuser2._id}`]: joinedAt } },
    );
    await col.messages().insertOne({ ...old[0], _id: undefined, text: 'new 1', createdAt: new Date() });

    const res = await c.as(testuser2T).get(`/api/channels/${general._id}/messages`);
    assert.deepEqual(res.body.map((m) => m.text), ['old 3', 'old 4', 'old 5', 'new 1']);
  });
});

describe('Moderation', () => {
  it('setting an age limit removes members under it', async () => {
    const res = await c.as(groupadmin.token).patch(`/api/groups/${group._id}`, { ageLimit: 18 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.removedForAge, ['user2']);

    const again = await c.as(user2.token).post('/api/requests', { type: 'joinGroup', groupId: group._id });
    assert.equal(again.status, 403);
  });

  it('a member asks to leave and the admin approves', async () => {
    const req = await c.as(testuser1.token).post('/api/requests', { type: 'leaveGroup', groupId: group._id });
    assert.equal(req.status, 201);
    await c.as(groupadmin.token).post(`/api/requests/${req.body._id}/approve`);
    const mine = await c.as(testuser1.token).get('/api/groups/mine');
    assert.equal(mine.body.length, 0);
  });

  it('a banned member is removed and cannot ask to rejoin', async () => {
    const testuser2T = await c.login('testuser2', 'newpass');
    const testuser2 = (await c.as(testuser2T).get('/api/auth/me')).body;
    const ban = await c.as(groupadmin.token).post(`/api/groups/${group._id}/bans`, { userId: testuser2._id, reason: 'Spam' });
    assert.equal(ban.status, 201);

    const rejoin = await c.as(testuser2T).post('/api/requests', { type: 'joinGroup', groupId: group._id });
    assert.equal(rejoin.status, 403);

    const history = await c.as(groupadmin.token).get(`/api/groups/${group._id}/members`);
    const statuses = Object.fromEntries(history.body.history.map((m) => [m.username, m.status]));
    assert.equal(statuses.testuser2, 'banned');
    assert.equal(statuses.testuser1, 'past');
    assert.equal(statuses.user1, 'current');
  });

  it('the super admin sees the ban in the ban log', async () => {
    const res = await c.as(superT).get('/api/admin/bans');
    assert.ok(res.body.log.some((e) => e.type === 'member.ban' && e.details.username === 'testuser2'));
  });

  it('a group admin requests a promotion and the super admin approves', async () => {
    const req = await c.as(groupadmin.token).post('/api/requests', { type: 'promoteMember', groupId: group._id, targetUserId: user1.user._id });
    assert.equal(req.status, 201);
    await c.as(superT).post(`/api/requests/${req.body._id}/approve`);

    const me = await c.as(user1.token).get('/api/auth/me');
    assert.equal(me.body.role, 'groupAdmin');
    const members = await c.as(user1.token).get(`/api/groups/${group._id}/members`);
    assert.ok(members.body.history, 'user1 can now see the admin member history');
  });

  it('hard banning a user blocks sign-in and their existing token', async () => {
    const ban = await c.as(superT).post(`/api/admin/users/${testuser1.user._id}/hardban`, { reason: 'Abuse' });
    assert.equal(ban.status, 200);
    const login = await c.api.post('/api/auth/login').send({ login: 'testuser1', password: 'secret' });
    assert.equal(login.status, 403);
    const old = await c.as(testuser1.token).get('/api/auth/me');
    assert.equal(old.status, 401);
  });
});

describe('Audit log', () => {
  it('filters by type and sorts by date', async () => {
    const res = await c.as(superT).get('/api/admin/audit?type=member.join&order=asc');
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.length >= 3);
    assert.ok(res.body.entries.every((e) => e.type === 'member.join'));
    const times = res.body.entries.map((e) => new Date(e.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });
});

describe('Deleting', () => {
  it('deletes chatrooms that have been inactive too long', async () => {
    const { col, toId } = db;
    await col.channels().updateOne({ _id: toId(general._id) }, { $set: { lastActivityAt: new Date('2020-01-01') } });
    const deleted = await deleteInactiveChannels(30);
    assert.equal(deleted, 1);
  });

  it('a group admin requests group deletion and the super admin approves', async () => {
    const req = await c.as(groupadmin.token).post('/api/requests', { type: 'deleteGroup', groupId: group._id });
    assert.equal(req.status, 201);
    await c.as(superT).post(`/api/requests/${req.body._id}/approve`);
    const mine = await c.as(groupadmin.token).get('/api/groups/mine');
    assert.equal(mine.body.some((g) => g._id === group._id), false);
  });
});
