const router = require('express').Router();
const { authenticate, forbidSuper } = require('../auth');
const svc = require('../services');
const { HttpError, isMember, isGroupAdmin } = require('../utils');

router.use(authenticate, forbidSuper);

async function loadChannel(req, res, next) {
  req.channel = await svc.findChannel(req.params.cid);
  req.group = await svc.findGroup(req.channel.groupId);
  if (!isMember(req.group, req.user._id)) throw new HttpError(403, 'You are not a member of this group');
  next();
}

// GET /api/channels/:cid/messages -> history (see services.historyFor for the 3-message rule)
router.get('/:cid/messages', loadChannel, async (req, res) => {
  res.json(await svc.historyFor(req.channel, req.group, req.user._id));
});

// DELETE /api/channels/:cid  (group admin)
router.delete('/:cid', loadChannel, async (req, res) => {
  if (!isGroupAdmin(req.group, req.user)) throw new HttpError(403, 'Only this group’s admins can delete chatrooms');
  await svc.deleteChannel(req.channel, req.group, req.user);
  res.status(204).end();
});

module.exports = router;
