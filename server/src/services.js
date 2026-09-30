const { col, toId } = require('./db');
const { audit } = require('./audit');
const realtime = require('./realtime');
const { HttpError, hasId, ageOn, isGroupAdmin, isMember } = require('./utils');



async function findGroup(id) {
  const group = await col.groups().findOne({ _id: toId(id) });
  if (!group) throw new HttpError(404, 'Group not found');
  return group;
}

async function findChannel(id) {
  const channel = await col.channels().findOne({ _id: toId(id) });
  if (!channel) throw new HttpError(404, 'Chatroom not found');
  return channel;
}

async function loadMemberGroup(req, res, next) {
  req.group = await findGroup(req.params.gid);
  if (!isMember(req.group, req.user._id)) throw new HttpError(403, 'You are not a member of this group');
  next();
}

function requireGroupAdmin(req, res, next) {
  if (!isGroupAdmin(req.group, req.user)) throw new HttpError(403, 'Only this group’s admins can do that');
  next();
}

async function channelIdsOf(groupId) {
  const channels = await col.channels().find({ groupId }, { projection: { _id: 1 } }).toArray();
  return channels.map((c) => c._id);
}


async function assertGroupNameFree(name, exceptId = null) {
  const existing = await col.groups().findOne({ nameKey: name.toLowerCase() });
  if (existing && String(existing._id) !== String(exceptId)) throw new HttpError(409, `A group called "${name}" already exists`);
}

async function createGroup(name, admin, actor) {
  await assertGroupNameFree(name);
  const now = new Date();
  const group = {
    name,
    nameKey: name.toLowerCase(),
    theme: 'blue',
    ageLimit: null,
    adminIds: [admin._id],
    memberIds: [admin._id],
    memberSince: { [String(admin._id)]: now },
    pastMemberIds: [],
    bannedIds: [],
    createdBy: admin._id,
    createdAt: now,
  };
  const { insertedId } = await col.groups().insertOne(group);
  group._id = insertedId;
  if (admin.role === 'user') await col.users().updateOne({ _id: admin._id }, { $set: { role: 'groupAdmin' } });
  await createChannel(group, 'general', actor);
  await audit('group.create', actor, { groupName: name, adminName: admin.username }, group._id);
  realtime.groupChanged(group);
  return group;
}

async function deleteGroup(group, actor) {
  const channelIds = await channelIdsOf(group._id);
  await col.messages().deleteMany({ channelId: { $in: channelIds } });
  await col.channels().deleteMany({ groupId: group._id });
  await col.requests().updateMany({ groupId: group._id, status: 'pending' }, { $set: { status: 'cancelled' } });
  await col.groups().deleteOne({ _id: group._id });
  await audit('group.delete', actor, { groupName: group.name }, group._id);
  for (const id of group.memberIds) realtime.kickFromChannels(id, channelIds);
  realtime.groupChanged(group);
}


async function addMember(group, user, actor) {
  if (hasId(group.bannedIds, user._id)) throw new HttpError(400, `${user.username} is banned from this group`);
  if (user.hardBanned) throw new HttpError(400, `${user.username}'s account is banned`);
  if (group.ageLimit && ageOn(user.birthdate) < group.ageLimit) {
    throw new HttpError(400, `${user.username} is under this group's age limit of ${group.ageLimit}`);
  }
  if (isMember(group, user._id)) return;

  await col.groups().updateOne(
    { _id: group._id },
    { $addToSet: { memberIds: user._id }, $set: { [`memberSince.${user._id}`]: new Date() } },
  );
  await audit('member.join', actor, { username: user.username, groupName: group.name }, group._id);
  realtime.groupChanged(group, [user._id]);
}

async function removeMember(group, user, actor, type = 'member.leave', details = {}) {
  await col.groups().updateOne(
    { _id: group._id },
    { $pull: { memberIds: user._id, adminIds: user._id }, $addToSet: { pastMemberIds: user._id } },
  );
  await audit(type, actor, { username: user.username, groupName: group.name, ...details }, group._id);
  realtime.kickFromChannels(user._id, await channelIdsOf(group._id));
  realtime.groupChanged(group, [user._id]);
}

async function enforceAgeLimit(group, actor) {
  if (!group.ageLimit) return [];
  const members = await col.users()
    .find({ _id: { $in: group.memberIds.filter((id) => !hasId(group.adminIds, id)) } })
    .toArray();
  const underage = members.filter((u) => ageOn(u.birthdate) < group.ageLimit);
  for (const user of underage) {
    await removeMember(group, user, actor, 'member.ageRemoved', { ageLimit: group.ageLimit });
  }
  return underage.map((u) => u.username);
}


async function createChannel(group, name, actor) {
  if (await col.channels().findOne({ groupId: group._id, name })) {
    throw new HttpError(409, `This group already has a #${name} chatroom`);
  }
  const now = new Date();
  const channel = { groupId: group._id, name, createdBy: actor?._id ?? null, createdAt: now, lastActivityAt: now };
  const { insertedId } = await col.channels().insertOne(channel);
  channel._id = insertedId;
  await audit('channel.create', actor, { channelName: name, groupName: group.name }, group._id);
  realtime.groupChanged(group);
  return channel;
}

async function deleteChannel(channel, group, actor, type = 'channel.delete') {
  await col.messages().deleteMany({ channelId: channel._id });
  await col.channels().deleteOne({ _id: channel._id });
  await col.requests().updateMany(
    { channelId: channel._id, status: 'pending' },
    { $set: { status: 'cancelled' } },
  );
  await audit(type, actor, { channelName: channel.name, groupName: group?.name }, channel.groupId);
  realtime.getIo()?.to(`channel:${channel._id}`).emit('room:deleted', { channelId: String(channel._id) });
  if (group) realtime.groupChanged(group);
}


async function historyFor(channel, group, userId) {
  const joinedAt = new Date(group.memberSince?.[String(userId)] ?? group.createdAt);
  const before = await col.messages()
    .find({ channelId: channel._id, createdAt: { $lt: joinedAt } })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();
  const after = await col.messages()
    .find({ channelId: channel._id, createdAt: { $gte: joinedAt } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return [...before.reverse(), ...after.reverse()];
}

module.exports = {
  findGroup, findChannel, loadMemberGroup, requireGroupAdmin, channelIdsOf,
  assertGroupNameFree, createGroup, deleteGroup,
  addMember, removeMember, enforceAgeLimit,
  createChannel, deleteChannel, historyFor,
};
