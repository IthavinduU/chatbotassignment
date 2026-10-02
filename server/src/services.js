// Shared operations used by several routes (direct admin actions and approved requests).
const { col, toId } = require('./db');
const { audit } = require('./audit');
const realtime = require('./realtime');
const { removeUpload } = require('./uploads');
const { HttpError, hasId, ageOn, isGroupAdmin, isMember } = require('./utils');

/** Loads a group by id or fails with 404. */
async function findGroup(id) {
  const group = await col.groups().findOne({ _id: toId(id) });
  if (!group) throw new HttpError(404, 'Group not found');
  return group;
}

/** Loads a chatroom by id or fails with 404. */
async function findChannel(id) {
  const channel = await col.channels().findOne({ _id: toId(id) });
  if (!channel) throw new HttpError(404, 'Chatroom not found');
  return channel;
}

/** Loads req.group from :gid and checks the user belongs to it. */
async function loadMemberGroup(req, res, next) {
  req.group = await findGroup(req.params.gid);
  if (!isMember(req.group, req.user._id)) throw new HttpError(403, 'You are not a member of this group');
  next();
}

/** Only lets this group's admins continue. */
function requireGroupAdmin(req, res, next) {
  if (!isGroupAdmin(req.group, req.user)) throw new HttpError(403, 'Only this group’s admins can do that');
  next();
}

/** Ids of every chatroom in a group. */
async function channelIdsOf(groupId) {
  const channels = await col.channels().find({ groupId }, { projection: { _id: 1 } }).toArray();
  return channels.map((c) => c._id);
}

/** Fails if another group already has this name (ignoring capitals). */
async function assertGroupNameFree(name, exceptId = null) {
  const existing = await col.groups().findOne({ nameKey: name.toLowerCase() });
  if (existing && String(existing._id) !== String(exceptId)) throw new HttpError(409, `A group called "${name}" already exists`);
}

/** Creates a group with a #general chatroom. The admin becomes a group admin if they were a regular user. */
async function createGroup(name, admin, actor, ageLimit = null) {
  await assertGroupNameFree(name);
  const now = new Date();
  const group = {
    name,
    nameKey: name.toLowerCase(),
    theme: 'blue',
    ageLimit,
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
  await audit('group.create', actor, { groupName: name, adminName: admin.username, ageLimit }, group._id);
  realtime.toUsers([admin._id], 'account:changed');
  realtime.groupChanged(group);
  return group;
}

/** Deletes a group with all its chatrooms and messages. */
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

/** Adds a member, unless they are banned, hard banned or under the age limit. */
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

/** Moves a member to the "past members" list. `type` is the audit type. */
async function removeMember(group, user, actor, type = 'member.leave', details = {}) {
  await col.groups().updateOne(
    { _id: group._id },
    { $pull: { memberIds: user._id, adminIds: user._id }, $addToSet: { pastMemberIds: user._id } },
  );
  await audit(type, actor, { username: user.username, groupName: group.name, ...details }, group._id);
  realtime.kickFromChannels(user._id, await channelIdsOf(group._id));
  realtime.groupChanged(group, [user._id]);
}

/** Removes members who are younger than the group's age limit. Admins are never removed. */
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

/** Makes a current member an admin of the group (and a group admin if they were a regular user). */
async function promoteToGroupAdmin(group, target, actor) {
  if (!isMember(group, target._id)) throw new HttpError(404, `${target.username} is not a member of this group`);
  if (hasId(group.adminIds, target._id)) throw new HttpError(400, `${target.username} is already an admin of this group`);

  await col.groups().updateOne({ _id: group._id }, { $addToSet: { adminIds: target._id } });
  if (target.role === 'user') await col.users().updateOne({ _id: target._id }, { $set: { role: 'groupAdmin' } });
  await audit('member.promote', actor, { username: target.username, groupName: group.name }, group._id);
  realtime.toUsers([target._id], 'account:changed');
  realtime.groupChanged(group);
}

/**
 * Removes someone's admin rights for a group. They stay a member. If they no longer
 * administer any group they become a regular user. A group always keeps at least one admin.
 */
async function demoteFromGroup(group, target, actor) {
  if (!hasId(group.adminIds, target._id)) throw new HttpError(400, `${target.username} is not an admin of this group`);
  if (group.adminIds.length <= 1) throw new HttpError(400, 'A group needs at least one admin. Make someone else an admin first.');

  await col.groups().updateOne({ _id: group._id }, { $pull: { adminIds: target._id } });
  const adminElsewhere = await col.groups().countDocuments({ _id: { $ne: group._id }, adminIds: target._id });
  if (!adminElsewhere && target.role === 'groupAdmin') {
    await col.users().updateOne({ _id: target._id }, { $set: { role: 'user' } });
  }
  await audit('member.demote', actor, { username: target.username, groupName: group.name }, group._id);
  realtime.toUsers([target._id], 'account:changed');
  realtime.groupChanged(group);
}

/** Deletes an account: removes it from every group, cancels its requests and signs it out everywhere. */
async function deleteUser(target, actor) {
  const groups = await col.groups().find({ memberIds: target._id }).toArray();
  await col.groups().updateMany(
    {},
    { $pull: { memberIds: target._id, adminIds: target._id, pastMemberIds: target._id, bannedIds: target._id } },
  );
  await col.requests().updateMany({ requesterId: target._id, status: 'pending' }, { $set: { status: 'cancelled' } });
  await col.users().deleteOne({ _id: target._id });
  removeUpload(target.avatarUrl);
  await audit('user.delete', actor, { username: target.username });

  const io = realtime.getIo();
  if (io) {
    io.to(`user:${target._id}`).emit('account:deleted');
    io.in(`user:${target._id}`).disconnectSockets(true);
  }
  for (const g of groups) realtime.groupChanged(g);
}

/** Creates a chatroom in a group; names must be unique within the group. */
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

/** Deletes a chatroom and its messages and tells anyone inside it. */
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

/**
 * Message history rule: a member sees everything sent since they joined the group,
 * plus at most the 3 messages sent just before they joined.
 */
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
  addMember, removeMember, enforceAgeLimit, promoteToGroupAdmin, demoteFromGroup,
  deleteUser,
  createChannel, deleteChannel, historyFor,
};