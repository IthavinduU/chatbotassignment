const router = require('express').Router();
const { col, toId } = require('../db');
const { audit } = require('../audit');
const { authenticate, forbidSuper } = require('../auth');
const realtime = require('../realtime');
const svc = require('../services');
const { THEMES, HttpError, hasId, ageOn, isGroupAdmin, cleanName, channelSlug, publicUser } = require('../utils');

router.use(authenticate, forbidSuper);

/** Adds each group's chatrooms to it. */
async function withChannels(groups) {
  const channels = await col.channels().find({ groupId: { $in: groups.map((g) => g._id) } }).sort({ createdAt: 1 }).toArray();
  return groups.map((g) => ({ ...g, channels: channels.filter((c) => String(c.groupId) === String(g._id)) }));
}

// GET /api/groups/mine
router.get('/mine', async (req, res) => {
  const groups = await col.groups().find({ memberIds: req.user._id }).sort({ name: 1 }).toArray();
  res.json(await withChannels(groups));
});

// GET /api/groups/discover
router.get('/discover', async (req, res) => {
  const [groups, pending] = await Promise.all([
    col.groups().find({}).sort({ name: 1 }).toArray(),
    col.requests().find({ requesterId: req.user._id, type: 'joinGroup', status: 'pending' }).toArray(),
  ]);
  const age = ageOn(req.user.birthdate);

  res.json(groups.map((g) => {
    let status = 'none';
    if (hasId(g.memberIds, req.user._id)) status = 'member';
    else if (hasId(g.bannedIds, req.user._id)) status = 'banned';
    else if (pending.some((r) => String(r.groupId) === String(g._id))) status = 'pending';
    else if (g.ageLimit && age < g.ageLimit) status = 'tooYoung';
    return { _id: g._id, name: g.name, theme: g.theme, ageLimit: g.ageLimit, memberCount: g.memberIds.length, status };
  }));
});

// GET /api/groups/:gid/members
router.get('/:gid/members', svc.loadMemberGroup, async (req, res) => {
  const g = req.group;
  const ids = [...g.memberIds, ...g.pastMemberIds, ...g.bannedIds];
  const users = await col.users().find({ _id: { $in: ids } }).toArray();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const describe = (id) => {
    const u = byId.get(String(id));
    return u ? { ...publicUser(u), isAdmin: hasId(g.adminIds, id) } : null;
  };

  const current = g.memberIds.map(describe).filter(Boolean);
  const body = { current };

  if (isGroupAdmin(g, req.user)) {
    const seen = new Set();
    body.history = [...g.memberIds, ...g.bannedIds, ...g.pastMemberIds]
      .filter((id) => !seen.has(String(id)) && seen.add(String(id)))
      .map((id) => {
        const info = describe(id);
        if (!info) return null;
        const status = hasId(g.memberIds, id) ? 'current' : hasId(g.bannedIds, id) ? 'banned' : 'past';
        return { ...info, status };
      })
      .filter(Boolean);
  }
  res.json(body);
});

// PATCH /api/groups/:gid  { name?, theme?, ageLimit? }
router.patch('/:gid', svc.loadMemberGroup, svc.requireGroupAdmin, async (req, res) => {
  const g = req.group;
  const changes = {};

  if (req.body.name !== undefined) {
    const name = cleanName(req.body.name);
    if (!name) throw new HttpError(400, 'Group name must be 1–40 characters');
    await svc.assertGroupNameFree(name, g._id);
    Object.assign(changes, { name, nameKey: name.toLowerCase() });
  }
  if (req.body.theme !== undefined) {
    if (!THEMES.includes(req.body.theme)) throw new HttpError(400, `Theme must be one of: ${THEMES.join(', ')}`);
    changes.theme = req.body.theme;
  }
  if (req.body.ageLimit !== undefined) {
    const limit = req.body.ageLimit === null || req.body.ageLimit === '' ? null : Number(req.body.ageLimit);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 120)) {
      throw new HttpError(400, 'Age limit must be a whole number from 1 to 120, or empty for none');
    }
    changes.ageLimit = limit;
  }

  const changed = Object.keys(changes).filter((k) => k !== 'nameKey' && changes[k] !== g[k]);
  await col.groups().updateOne({ _id: g._id }, { $set: changes });
  const updated = { ...g, ...changes };
  if (changed.length) await audit('group.update', req.user, { groupName: updated.name, changed: changed.join(', ') }, g._id);

  const removed = changes.ageLimit ? await svc.enforceAgeLimit(updated, req.user) : [];
  realtime.groupChanged(updated);
  res.json({ group: await col.groups().findOne({ _id: g._id }), removedForAge: removed });
});

// POST /api/groups/:gid/admins  { userId }
router.post('/:gid/admins', svc.loadMemberGroup, svc.requireGroupAdmin, async (req, res) => {
  const target = await col.users().findOne({ _id: toId(req.body?.userId) });
  if (!target) throw new HttpError(404, 'User not found');
  await svc.promoteToGroupAdmin(req.group, target, req.user);
  res.status(201).json({ ok: true });
});

// DELETE /api/groups/:gid/admins/:uid
router.delete('/:gid/admins/:uid', svc.loadMemberGroup, svc.requireGroupAdmin, async (req, res) => {
  const target = await col.users().findOne({ _id: toId(req.params.uid) });
  if (!target) throw new HttpError(404, 'User not found');
  await svc.demoteFromGroup(req.group, target, req.user);
  res.json({ ok: true });
});

// POST /api/groups/:gid/bans  { userId, reason }
router.post('/:gid/bans', svc.loadMemberGroup, svc.requireGroupAdmin, async (req, res) => {
  const g = req.group;
  const target = await col.users().findOne({ _id: toId(req.body?.userId) });
  if (!target || !hasId(g.memberIds, target._id)) throw new HttpError(404, 'That user is not a member of this group');
  if (hasId(g.adminIds, target._id)) throw new HttpError(400, 'Group admins cannot be banned');

  const reason = String(req.body?.reason ?? '').trim().slice(0, 300) || 'No reason given';
  await col.groups().updateOne(
    { _id: g._id },
    { $pull: { memberIds: target._id }, $addToSet: { bannedIds: target._id } },
  );
  await col.requests().updateMany(
    { requesterId: target._id, groupId: g._id, status: 'pending' },
    { $set: { status: 'cancelled' } },
  );
  await audit('member.ban', req.user, { username: target.username, groupName: g.name, reason }, g._id);

  realtime.kickFromChannels(target._id, await svc.channelIdsOf(g._id));
  realtime.groupChanged(g, [target._id]);
  realtime.toSupers('bans:changed');
  res.status(201).json({ ok: true });
});

// POST /api/groups/:gid/channels  { name }
router.post('/:gid/channels', svc.loadMemberGroup, svc.requireGroupAdmin, async (req, res) => {
  const name = channelSlug(req.body?.name);
  if (!name) throw new HttpError(400, 'Chatroom name must be 1–30 letters, numbers or dashes');
  res.status(201).json(await svc.createChannel(req.group, name, req.user));
});

module.exports = router;