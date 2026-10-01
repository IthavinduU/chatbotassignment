// Super admin only: users, hard bans, ban log and audit log.
const router = require('express').Router();
const { col, toId } = require('../db');
const { audit, AUDIT_TYPES } = require('../audit');
const { authenticate, requireSuper } = require('../auth');
const realtime = require('../realtime');
const svc = require('../services');
const { HttpError, publicUser } = require('../utils');

router.use(authenticate, requireSuper);

async function loadUser(req, res, next) {
  req.target = await col.users().findOne({ _id: toId(req.params.id) });
  if (!req.target) throw new HttpError(404, 'User not found');
  if (req.target.role === 'superAdmin') throw new HttpError(400, 'Super admin accounts cannot be changed here');
  next();
}

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const users = await col.users().find({}).sort({ usernameKey: 1 }).toArray();
  res.json(users.map((u) => publicUser(u, true)));
});

// PATCH /api/admin/users/:id/role  { role: 'user' | 'groupAdmin' }
router.patch('/users/:id/role', loadUser, async (req, res) => {
  const { role } = req.body ?? {};
  if (!['user', 'groupAdmin'].includes(role)) throw new HttpError(400, 'Role must be user or groupAdmin');

  await col.users().updateOne({ _id: req.target._id }, { $set: { role } });
  if (role === 'user') {
    // A demoted user stops being an admin of any group.
    await col.groups().updateMany({ adminIds: req.target._id }, { $pull: { adminIds: req.target._id } });
  }
  await audit('user.roleChange', req.user, { username: req.target.username, role });
  realtime.toUsers([req.target._id], 'account:changed');
  res.json(publicUser({ ...req.target, role }, true));
});

// POST /api/admin/users/:id/hardban  { reason }
// A hard ban blocks sign-in, removes the user from every group and disconnects them.
router.post('/users/:id/hardban', loadUser, async (req, res) => {
  const target = req.target;
  if (target.hardBanned) throw new HttpError(409, `${target.username} is already banned`);
  const reason = String(req.body?.reason ?? '').trim().slice(0, 300) || 'No reason given';

  await col.users().updateOne(
    { _id: target._id },
    { $set: { hardBanned: true, hardBanReason: reason, hardBannedAt: new Date() } },
  );
  const groups = await col.groups().find({ memberIds: target._id }).toArray();
  for (const group of groups) await svc.removeMember(group, target, req.user, 'member.leave', { because: 'hardban' });
  await col.requests().updateMany({ requesterId: target._id, status: 'pending' }, { $set: { status: 'cancelled' } });
  await audit('user.hardban', req.user, { username: target.username, reason });

  const io = realtime.getIo();
  if (io) {
    io.to(`user:${target._id}`).emit('account:banned', { reason });
    io.in(`user:${target._id}`).disconnectSockets(true);
  }
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id/hardban -> lift a hard ban
router.delete('/users/:id/hardban', loadUser, async (req, res) => {
  await col.users().updateOne({ _id: req.target._id }, { $set: { hardBanned: false }, $unset: { hardBanReason: '', hardBannedAt: '' } });
  await audit('user.unban', req.user, { username: req.target.username });
  res.json({ ok: true });
});

// GET /api/admin/bans -> currently hard-banned users plus the full log of bans
router.get('/bans', async (req, res) => {
  const [hardBanned, log] = await Promise.all([
    col.users().find({ hardBanned: true }).sort({ hardBannedAt: -1 }).toArray(),
    col.audit().find({ type: { $in: ['member.ban', 'user.hardban', 'user.unban'] } }).sort({ createdAt: -1 }).limit(500).toArray(),
  ]);
  res.json({
    hardBanned: hardBanned.map((u) => ({ ...publicUser(u, true), hardBannedAt: u.hardBannedAt })),
    log,
  });
});

// GET /api/admin/audit?type=&order=asc|desc&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/audit', async (req, res) => {
  const query = {};
  if (req.query.type) {
    if (!AUDIT_TYPES.includes(req.query.type)) throw new HttpError(400, 'Unknown audit type');
    query.type = req.query.type;
  }
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;
  if (from && !Number.isNaN(from.getTime())) query.createdAt = { ...query.createdAt, $gte: from };
  if (to && !Number.isNaN(to.getTime())) query.createdAt = { ...query.createdAt, $lte: to };

  const order = req.query.order === 'asc' ? 1 : -1;
  const entries = await col.audit().find(query).sort({ createdAt: order }).limit(1000).toArray();
  res.json({ types: AUDIT_TYPES, entries });
});

module.exports = router;
