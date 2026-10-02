const router = require('express').Router();
const { col, toId } = require('../db');
const { audit } = require('../audit');
const { authenticate } = require('../auth');
const realtime = require('../realtime');
const svc = require('../services');
const { HttpError, hasId, ageOn, isMember, isGroupAdmin, cleanName, channelSlug } = require('../utils');

const GROUP_ADMIN_TYPES = ['joinGroup', 'leaveGroup', 'createChannel', 'deleteChannel'];
const SUPER_TYPES = ['createGroup', 'deleteGroup', 'promoteMember'];
const ALL_TYPES = [...GROUP_ADMIN_TYPES, ...SUPER_TYPES];

router.use(authenticate);

/** Fails if a matching request is already waiting. */
async function assertNoPending(query, message) {
  if (await col.requests().findOne({ ...query, status: 'pending' })) throw new HttpError(409, message);
}

/** Reads an optional minimum age: empty means none, otherwise a whole number from 1 to 120. */
function parseAgeLimit(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 120) {
    throw new HttpError(400, 'Minimum age must be a whole number from 1 to 120, or empty for none');
  }
  return n;
}

/** Tells whoever decides this kind of request that the list has changed. */
function notifyHandlers(request, group) {
  if (SUPER_TYPES.includes(request.type)) realtime.toSupers('requests:changed');
  else if (group) realtime.toUsers(group.adminIds, 'requests:changed');
}

// POST /api/requests  { type, groupId?, channelId?, targetUserId?, name?, ageLimit?, reason? }
router.post('/', async (req, res) => {
  const { type } = req.body ?? {};
  const user = req.user;
  if (!ALL_TYPES.includes(type)) throw new HttpError(400, 'Unknown request type');
  if (user.role === 'superAdmin') throw new HttpError(403, 'Super admins handle requests rather than sending them');

  const doc = {
    type,
    status: 'pending',
    requesterId: user._id,
    requesterName: user.username,
    reason: String(req.body.reason ?? '').trim().slice(0, 300) || null,
    createdAt: new Date(),
  };

  let group = null;
  if (type !== 'createGroup') {
    group = await svc.findGroup(req.body.groupId);
    Object.assign(doc, { groupId: group._id, groupName: group.name });
  }

  switch (type) {
    case 'joinGroup':
      if (isMember(group, user._id)) throw new HttpError(400, 'You are already a member of this group');
      if (hasId(group.bannedIds, user._id)) throw new HttpError(403, 'You have been banned from this group');
      if (group.ageLimit && ageOn(user.birthdate) < group.ageLimit) {
        throw new HttpError(403, `You must be at least ${group.ageLimit} to join this group`);
      }
      await assertNoPending({ type, requesterId: user._id, groupId: group._id }, 'You have already asked to join this group');
      break;

    case 'leaveGroup':
      if (!isMember(group, user._id)) throw new HttpError(400, 'You are not a member of this group');
      if (hasId(group.adminIds, user._id)) throw new HttpError(400, 'Group admins cannot leave their own group');
      await assertNoPending({ type, requesterId: user._id, groupId: group._id }, 'You have already asked to leave this group');
      break;

    case 'createChannel': {
      if (!isMember(group, user._id)) throw new HttpError(403, 'You are not a member of this group');
      const name = channelSlug(req.body.name);
      if (!name) throw new HttpError(400, 'Chatroom name must be 1–30 letters, numbers or dashes');
      if (await col.channels().findOne({ groupId: group._id, name })) throw new HttpError(409, `#${name} already exists`);
      await assertNoPending({ type, groupId: group._id, name }, `Someone has already asked for #${name}`);
      doc.name = name;
      break;
    }

    case 'deleteChannel': {
      if (!isMember(group, user._id)) throw new HttpError(403, 'You are not a member of this group');
      const channel = await svc.findChannel(req.body.channelId);
      if (String(channel.groupId) !== String(group._id)) throw new HttpError(404, 'Chatroom not found in this group');
      await assertNoPending({ type, channelId: channel._id }, `Deletion of #${channel.name} has already been requested`);
      Object.assign(doc, { channelId: channel._id, channelName: channel.name });
      break;
    }

    case 'createGroup': {
      const name = cleanName(req.body.name);
      if (!name) throw new HttpError(400, 'Group name must be 1–40 characters');
      const ageLimit = parseAgeLimit(req.body.ageLimit);
      await svc.assertGroupNameFree(name);
      await assertNoPending({ type, nameKey: name.toLowerCase() }, `A group called "${name}" has already been requested`);
      Object.assign(doc, { name, nameKey: name.toLowerCase(), ageLimit });
      break;
    }

    case 'deleteGroup':
      if (!isGroupAdmin(group, user)) throw new HttpError(403, 'Only this group’s admins can request its deletion');
      await assertNoPending({ type, groupId: group._id }, 'Deletion of this group has already been requested');
      break;

    case 'promoteMember': {
      if (!isGroupAdmin(group, user)) throw new HttpError(403, 'Only this group’s admins can request promotions');
      const target = await col.users().findOne({ _id: toId(req.body.targetUserId) });
      if (!target || !isMember(group, target._id)) throw new HttpError(404, 'That user is not a member of this group');
      if (hasId(group.adminIds, target._id)) throw new HttpError(400, `${target.username} is already an admin of this group`);
      await assertNoPending({ type, groupId: group._id, targetUserId: target._id }, `${target.username}'s promotion has already been requested`);
      Object.assign(doc, { targetUserId: target._id, targetName: target.username });
      break;
    }
  }

  const { insertedId } = await col.requests().insertOne(doc);
  doc._id = insertedId;
  await audit('request.create', user, { requestType: type, groupName: doc.groupName, name: doc.name ?? doc.channelName ?? doc.targetName }, doc.groupId ?? null);
  notifyHandlers(doc, group);
  res.status(201).json(doc);
});

// GET /api/requests/mine
router.get('/mine', async (req, res) => {
  res.json(await col.requests().find({ requesterId: req.user._id }).sort({ createdAt: -1 }).limit(100).toArray());
});

// GET /api/requests/incoming?type=
router.get('/incoming', async (req, res) => {
  const type = req.query.type;
  const query = { status: 'pending' };

  if (req.user.role === 'superAdmin') {
    query.type = SUPER_TYPES.includes(type) ? type : { $in: SUPER_TYPES };
  } else if (req.user.role === 'groupAdmin') {
    const groups = await col.groups().find({ adminIds: req.user._id }, { projection: { _id: 1 } }).toArray();
    query.groupId = { $in: groups.map((g) => g._id) };
    query.type = GROUP_ADMIN_TYPES.includes(type) ? type : { $in: GROUP_ADMIN_TYPES };
  } else {
    return res.json([]);
  }
  res.json(await col.requests().find(query).sort({ createdAt: 1 }).toArray());
});

/** Loads req.request and checks it is still pending. */
async function loadPending(req, res, next) {
  const request = await col.requests().findOne({ _id: toId(req.params.id) });
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.status !== 'pending') throw new HttpError(400, `This request has already been ${request.status}`);
  req.request = request;
  next();
}

/** Checks the user is allowed to decide this request. */
async function requireHandler(req, res, next) {
  const { request, user } = req;
  if (SUPER_TYPES.includes(request.type)) {
    if (user.role !== 'superAdmin') throw new HttpError(403, 'Only super admins can decide this request');
  } else {
    req.group = await svc.findGroup(request.groupId);
    if (!isGroupAdmin(req.group, user)) throw new HttpError(403, 'Only this group’s admins can decide this request');
  }
  next();
}

/** Marks a request approved or rejected, logs it and tells the people involved. */
async function finish(req, status) {
  const { request, user } = req;
  await col.requests().updateOne(
    { _id: request._id },
    { $set: { status, handledBy: user._id, handledByName: user.username, handledAt: new Date() } },
  );
  await audit(status === 'approved' ? 'request.approve' : 'request.reject', user,
    { requestType: request.type, requester: request.requesterName, groupName: request.groupName }, request.groupId ?? null);
  realtime.toUsers([request.requesterId], 'requests:changed');
  notifyHandlers(request, req.group);
}

// POST /api/requests/:id/approve
router.post('/:id/approve', loadPending, requireHandler, async (req, res) => {
  const { request, user } = req;
  const requester = await col.users().findOne({ _id: request.requesterId });
  if (!requester) throw new HttpError(400, 'The person who sent this request no longer exists');

  switch (request.type) {
    case 'joinGroup':
      await svc.addMember(req.group, requester, user);
      break;
    case 'leaveGroup':
      if (isMember(req.group, requester._id)) await svc.removeMember(req.group, requester, user, 'member.leave');
      break;
    case 'createChannel':
      await svc.createChannel(req.group, request.name, user);
      break;
    case 'deleteChannel': {
      const channel = await col.channels().findOne({ _id: request.channelId });
      if (channel) await svc.deleteChannel(channel, req.group, user);
      break;
    }
    case 'createGroup':
      await svc.createGroup(request.name, requester, user, request.ageLimit ?? null);
      break;
    case 'deleteGroup': {
      const group = await col.groups().findOne({ _id: request.groupId });
      if (group) await svc.deleteGroup(group, user);
      break;
    }
    case 'promoteMember': {
      const group = await svc.findGroup(request.groupId);
      const target = await col.users().findOne({ _id: request.targetUserId });
      if (!target) throw new HttpError(400, 'That user no longer exists');
      await svc.promoteToGroupAdmin(group, target, user);
      break;
    }
  }

  await finish(req, 'approved');
  res.json({ ok: true });
});

// POST /api/requests/:id/reject
router.post('/:id/reject', loadPending, requireHandler, async (req, res) => {
  await finish(req, 'rejected');
  res.json({ ok: true });
});

// DELETE /api/requests/:id
router.delete('/:id', loadPending, async (req, res) => {
  if (String(req.request.requesterId) !== String(req.user._id)) throw new HttpError(403, 'You can only cancel your own requests');
  await col.requests().updateOne({ _id: req.request._id }, { $set: { status: 'cancelled' } });
  await audit('request.cancel', req.user, { requestType: req.request.type, groupName: req.request.groupName }, req.request.groupId ?? null);
  const group = req.request.groupId ? await col.groups().findOne({ _id: req.request.groupId }) : null;
  notifyHandlers(req.request, group);
  res.status(204).end();
});

module.exports = router;