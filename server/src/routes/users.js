const router = require('express').Router();
const { col } = require('../db');
const { authenticate } = require('../auth');
const { imageUpload, publicPath, removeUpload } = require('../uploads');
const { HttpError, publicUser } = require('../utils');

router.use(authenticate);

router.patch('/me', imageUpload.single('avatar'), async (req, res) => {
  const avatarUrl = publicPath(req.file);
  if (!avatarUrl) throw new HttpError(400, 'Choose an image to upload');

  await col.users().updateOne({ _id: req.user._id }, { $set: { avatarUrl } });
  removeUpload(req.user.avatarUrl);
  res.json(publicUser({ ...req.user, avatarUrl }, true));
});

module.exports = router;
