const router = require('express').Router();
const { authenticate } = require('../auth');
const { imageUpload, publicPath } = require('../uploads');
const { HttpError } = require('../utils');

// POST /api/uploads  (multipart: image) -> { url }   used for images sent in chat
router.post('/', authenticate, imageUpload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image to upload');
  res.status(201).json({ url: publicPath(req.file) });
});

module.exports = router;
