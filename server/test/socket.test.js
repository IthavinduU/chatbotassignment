const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { io: connect } = require('socket.io-client');
const { db, createApp, resetDatabase, makeClient } = require('./helpers');
const { attachSocket } = require('../src/socket');

let server, url, c, superT, alice, bob, outsider, group, general;
const sockets = [];

/** Opens a socket with a token and resolves once it has connected. */
function open(token) {
  return new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
/** Emits an event and resolves with the server's acknowledgement. */
const emit = (s, event, data) => new Promise((resolve) => s.emit(event, data, resolve));
/** Resolves with the next payload of an event. */
const once = (s, event) => new Promise((resolve) => s.once(event, resolve));

before(async () => {
  await resetDatabase();
  const app = createApp();
  server = http.createServer(app);
  attachSocket(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;

  c = makeClient(app);
  superT = await c.login('super', '123');
  alice = await c.register('alice');
  bob = await c.register('bob');
  outsider = await c.register('outsider');
  await c.as(superT).patch(`/api/admin/users/${alice.user._id}/role`, { role: 'groupAdmin' });
  const req = await c.as(alice.token).post('/api/requests', { type: 'createGroup', name: 'Live' });
  await c.as(superT).post(`/api/requests/${req.body._id}/approve`);
  group = (await c.as(alice.token).get('/api/groups/mine')).body[0];
  general = group.channels[0];
  const join = await c.as(bob.token).post('/api/requests', { type: 'joinGroup', groupId: group._id });
  await c.as(alice.token).post(`/api/requests/${join.body._id}/approve`);
});

after(async () => {
  sockets.forEach((s) => s.close());
  await new Promise((r) => server.close(r));
  await db.close();
});

describe('Real-time chat (Socket.io)', () => {
  it('refuses a connection without a valid token', async () => {
    await assert.rejects(open('not-a-token'));
  });

  it('notifies people in a chatroom when someone new joins it', async () => {
    const a = await open(alice.token);
    assert.deepEqual(await emit(a, 'room:join', { channelId: general._id }), { ok: true });

    const b = await open(bob.token);
    const toast = once(a, 'room:userJoined');
    await emit(b, 'room:join', { channelId: general._id });
    assert.equal((await toast).username, 'bob');
  });

  it('delivers a message to everyone in the chatroom and saves it', async () => {
    const [a, b] = sockets.slice(-2);
    const received = once(a, 'message:new');
    const ack = await emit(b, 'message:send', { channelId: general._id, text: 'Hello live' });
    assert.equal(ack.ok, true);
    const msg = await received;
    assert.equal(msg.text, 'Hello live');
    assert.equal(msg.username, 'bob');

    const history = await c.as(alice.token).get(`/api/channels/${general._id}/messages`);
    assert.ok(history.body.some((m) => m.text === 'Hello live'));
  });

  it('notifies people in a chatroom when someone leaves it', async () => {
    const [a, b] = sockets.slice(-2);
    const note = once(a, 'room:userLeft');
    b.emit('room:leave', { channelId: general._id });
    const e = await note;
    assert.equal(e.username, 'bob');
    assert.equal(e.channelId, general._id);
  });

  it('does not let non-members join or send', async () => {
    const o = await open(outsider.token);
    const join = await emit(o, 'room:join', { channelId: general._id });
    assert.equal(join.ok, false);
    const send = await emit(o, 'message:send', { channelId: general._id, text: 'hi' });
    assert.equal(send.ok, false);
  });

  it('reports who is online', async () => {
    // Listen before connecting: the server sends the online list straight after connection.
    const s = connect(url, { auth: { token: bob.token }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    const online = await once(s, 'presence');
    assert.ok(online.includes(String(alice.user._id)));
    assert.ok(online.includes(String(bob.user._id)));
  });
});