const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { createHash, randomBytes } = require('crypto');
const config = require('../config');
const { col } = require('../db');
const { audit } = require('../audit');
const { signToken, authenticate } = require('../auth');
const { imageUpload, publicPath, removeUpload } = require('../uploads');
const { HttpError, publicUser } = require('../utils');

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = (t) => createHash('sha256').update(t).digest('hex');

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 3) throw new HttpError(400, 'Password must be at least 3 characters');
}

// POST /api/auth/register  (multipart: username, email, password, birthdate, avatar?)
router.post('/register', imageUpload.single('avatar'), async (req, res) => {
  const avatarUrl = publicPath(req.file);
  try {
    const username = String(req.body.username ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const birthdate = new Date(req.body.birthdate);

    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Username must be 3–20 characters: letters, numbers, dots, dashes or underscores');
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
    validatePassword(req.body.password);
    if (Number.isNaN(birthdate.getTime()) || birthdate > new Date()) throw new HttpError(400, 'Enter a valid date of birth');

    if (await col.users().findOne({ email })) throw new HttpError(409, 'An account with that email already exists');
    if (await col.users().findOne({ usernameKey: username.toLowerCase() })) throw new HttpError(409, `The username "${username}" is taken`);

    const user = {
      username,
      usernameKey: username.toLowerCase(),
      email,
      passwordHash: await bcrypt.hash(req.body.password, 10),
      birthdate,
      avatarUrl,
      role: 'user',
      hardBanned: false,
      createdAt: new Date(),
    };
    const { insertedId } = await col.users().insertOne(user);
    user._id = insertedId;
    await audit('user.register', user, { username });

    res.status(201).json({ token: signToken(user), user: publicUser(user, true) });
  } catch (err) {
    removeUpload(avatarUrl); // don't keep the image if the account wasn't created
    throw err;
  }
});

// POST /api/auth/login  { login (username or email), password }
router.post('/login', async (req, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!login || !password) throw new HttpError(400, 'Enter your username or email and your password');

  const user = await col.users().findOne({ $or: [{ usernameKey: login }, { email: login }] });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Username, email or password is incorrect');
  }
  if (user.hardBanned) throw new HttpError(403, 'This account has been banned');

  res.json({ token: signToken(user), user: publicUser(user, true) });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => res.json(publicUser(req.user, true)));

// POST /api/auth/forgot-password  { email }
// There is no email server in this project, so the reset link is printed in the server terminal.
// Outside production it is also returned as devResetUrl so it can be demonstrated in the UI.
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const response = { message: 'If that email is registered, a reset link has been sent.' };
  const user = email ? await col.users().findOne({ email }) : null;

  if (user && !user.hardBanned) {
    const token = randomBytes(32).toString('hex');
    await col.users().updateOne(
      { _id: user._id },
      { $set: { resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + 30 * 60_000) } },
    );
    const resetUrl = `${config.clientOrigin}/reset-password?token=${token}`;
    console.log(`\n[password reset] ${user.username}: ${resetUrl}\n`);
    if (!config.isProduction) response.devResetUrl = resetUrl;
  }
  res.json(response);
});

// POST /api/auth/reset-password  { token, password }
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '');
  validatePassword(req.body?.password);

  const user = await col.users().findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } });
  if (!token || !user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');

  await col.users().updateOne(
    { _id: user._id },
    { $set: { passwordHash: await bcrypt.hash(req.body.password, 10) }, $unset: { resetTokenHash: '', resetTokenExpires: '' } },
  );
  await audit('user.passwordReset', user, { username: user.username });
  res.json({ message: 'Password updated. You can now sign in.' });
});

module.exports = router;
