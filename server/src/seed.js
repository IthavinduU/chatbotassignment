// Demo data for an empty database (used when SEED_DEMO=true, and by the tests)
const bcrypt = require('bcryptjs');
const { col } = require('./db');

// Every demo account uses this password
const DEMO_PASSWORD = '123';

// Creates one demo user and returns it with its new id
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

// Adds the super admin, plus demo users, groups and messages when demo is true
async function seed({ demo = true } = {}) {
  // Only runs on an empty database
  if ((await col.users().countDocuments()) > 0) return false;

  const superAdmin = await makeUser('super', 'superAdmin', '1990-01-01');
  console.log('Created super admin: super / 123');
  if (!demo) return true;

  // Demo users
  const groupadmin = await makeUser('groupadmin', 'groupAdmin', '1995-05-12');
  const user1 = await makeUser('user1', 'user', '2001-09-03');
  const user2 = await makeUser('user2', 'user', '2010-02-20'); // under 18, useful for testing age limits

  // Demo groups were "created" 3 days ago
  const earlier = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const group = {
    name: 'Study Group',
    nameKey: 'study group',
    theme: 'blue',
    ageLimit: null,
    adminIds: [groupadmin._id],
    memberIds: [groupadmin._id, user1._id],
    memberSince: { [String(groupadmin._id)]: earlier, [String(user1._id)]: earlier },
    pastMemberIds: [],
    bannedIds: [],
    createdBy: superAdmin._id,
    createdAt: earlier,
  };
  group._id = (await col.groups().insertOne(group)).insertedId;

  // Second group, copied from the first with a different name, theme and members
  const second = {
    ...group,
    _id: undefined,
    name: 'Gaming',
    nameKey: 'gaming',
    theme: 'red',
    memberIds: [groupadmin._id],
    memberSince: { [String(groupadmin._id)]: earlier },
  };
  delete second._id;
  second._id = (await col.groups().insertOne(second)).insertedId;

  // Chatrooms for both groups
  const channels = [
    { groupId: group._id, name: 'general' },
    { groupId: group._id, name: 'assignment-help' },
    { groupId: second._id, name: 'general' },
  ].map((c) => ({ ...c, createdBy: groupadmin._id, createdAt: earlier, lastActivityAt: new Date() }));
  const { insertedIds } = await col.channels().insertMany(channels);

  // Sample conversation in Study Group #general, one hour apart
  const lines = [
    [groupadmin, 'Welcome to the study group!'],
    [user1, 'Thanks! Has anyone started the assignment?'],
    [groupadmin, 'Yes, the brief is on the course site.'],
    [user1, 'I will push my part tonight.'],
    [groupadmin, 'Sounds good.'],
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

  // A pending join request, so the requests menu has something in it
  await col.requests().insertOne({
    type: 'joinGroup', status: 'pending',
    requesterId: user1._id, requesterName: 'user1',
    groupId: second._id, groupName: 'Gaming',
    reason: null, createdAt: new Date(),
  });

  console.log('Created demo users groupadmin, user1 and user2 (password 123) and two groups');
  return true;
}

module.exports = { seed };