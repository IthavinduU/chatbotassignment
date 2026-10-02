const router = require('express').Router();
const { col } = require('../db');
const { authenticate } = require('../auth');
const svc = require('../services');
const { imageUpload, publicPath, removeUpload } = require('../uploads');
const { HttpError, publicUser } = require('../utils');

router.use(authenticate);

// PATCH /api/users/me  (multipart: avatar)
router.patch('/me', imageUpload.single('avatar'), async (req, res) => {
  const avatarUrl = publicPath(req.file);
  if (!avatarUrl) throw new HttpError(400, 'Choose an image to upload');

  await col.users().updateOne({ _id: req.user._id }, { $set: { avatarUrl } });
  removeUpload(req.user.avatarUrl);
  res.json(publicUser({ ...req.user, avatarUrl }, true));
});

// DELETE /api/users/me
router.delete('/me', async (req, res) => {
  if (req.user.role === 'superAdmin' && (await col.users().countDocuments({ role: 'superAdmin' })) === 1) {
    throw new HttpError(400, 'The only super admin cannot delete their account');
  }
  await svc.deleteUser(req.user, req.user);
  res.status(204).end();
});

module.exports = router;