const bcrypt = require('bcryptjs');
const { col } = require('./db');

const DEMO_PASSWORD = '123';

async function makeUser(username, role, birthdate) {
  const user = {
    username,
    usernameKey: username.toLowerCase(),
    email: `${username}@fabulari.local`,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    birthdate: new Date(birthdate),
    avatarUrl: null,
    role,
    hardBanned: false,
    createdAt: new Date(),
  };
  user._id = (await col.users().insertOne(user)).insertedId;
  return user;
}

async function seed({ demo = true } = {}) {
  if ((await col.users().countDocuments()) > 0) return false;

  const superAdmin = await makeUser('super', 'superAdmin', '1990-01-01');
  console.log('Created super admin: super / 123');
  if (!demo) return true;

  const alice = await makeUser('alice', 'groupAdmin', '1995-05-12');
  const bob = await makeUser('bob', 'user', '2001-09-03');
  const carol = await makeUser('carol', 'user', '2010-02-20'); // under 18, useful for testing age limits

  const earlier = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const group = {
    name: 'Study Group',
    nameKey: 'study group',
    theme: 'blue',
    ageLimit: null,
    adminIds: [alice._id],
    memberIds: [alice._id, bob._id],
    memberSince: { [String(alice._id)]: earlier, [String(bob._id)]: earlier },
    pastMemberIds: [],
    bannedIds: [],
    createdBy: superAdmin._id,
    createdAt: earlier,
  };
  group._id = (await col.groups().insertOne(group)).insertedId;

  const second = {
    ...group,
    _id: undefined,
    name: 'Gaming',
    nameKey: 'gaming',
    theme: 'red',
    memberIds: [alice._id],
    memberSince: { [String(alice._id)]: earlier },
  };
  delete second._id;
  second._id = (await col.groups().insertOne(second)).insertedId;

  const channels = [
    { groupId: group._id, name: 'general' },
    { groupId: group._id, name: 'assignment-help' },
    { groupId: second._id, name: 'general' },
  ].map((c) => ({ ...c, createdBy: alice._id, createdAt: earlier, lastActivityAt: new Date() }));
  const { insertedIds } = await col.channels().insertMany(channels);

  const lines = [
    [alice, 'Welcome to the study group!'],
    [bob, 'Thanks! Has anyone started the assignment?'],
    [alice, 'Yes, the brief is on the course site.'],
    [bob, 'I will push my part tonight.'],
    [alice, 'Sounds good.'],
  ];
  await col.messages().insertMany(lines.map(([u, text], i) => ({
    channelId: insertedIds[0],
    groupId: group._id,
    userId: u._id,
    username: u.username,
    avatarUrl: null,
    text,
    imageUrl: null,
    createdAt: new Date(earlier.getTime() + (i + 1) * 60 * 60 * 1000),
  })));

  await col.requests().insertOne({
    type: 'joinGroup', status: 'pending',
    requesterId: bob._id, requesterName: 'bob',
    groupId: second._id, groupName: 'Gaming',
    reason: null, createdAt: new Date(),
  });

  console.log('Created demo users alice, bob and carol (password 123) and two groups');
  return true;
}

module.exports = { seed };
