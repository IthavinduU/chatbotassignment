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

/** Hashes a reset token so the database never holds the token itself. */
const hashToken = (t) => createHash('sha256').update(t).digest('hex');

/** Rejects passwords shorter than 3 characters. */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 3) throw new HttpError(400, 'Password must be at least 3 characters');
}

/** True when nobody has set up the super admin yet (a brand new install). */
async function needsBootstrap() {
  return (await col.users().countDocuments({ role: 'superAdmin' })) === 0;
}

/** Makes a free username from an email address, e.g. "user1@com.au" -> "user1" (or "user12" if taken). */
async function usernameFromEmail(email) {
  let base = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20);
  if (base.length < 3) base = `user${base}`;
  let candidate = base;
  for (let n = 2; await col.users().findOne({ usernameKey: candidate.toLowerCase() }); n++) {
    candidate = `${base.slice(0, 20 - String(n).length)}${n}`;
  }
  return candidate;
}

/** Checks sign-up details and returns them cleaned. The username is optional: it can come from the email. */
async function validateNewUser(body) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const birthdate = new Date(body.birthdate);
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
  validatePassword(body.password);
  if (Number.isNaN(birthdate.getTime()) || birthdate > new Date()) throw new HttpError(400, 'Enter a valid date of birth');
  if (await col.users().findOne({ email })) throw new HttpError(409, 'An account with that email already exists');

  let username = String(body.username ?? '').trim();
  if (!username) {
    username = await usernameFromEmail(email);
  } else {
    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Username must be 3–20 characters: letters, numbers, dots, dashes or underscores');
    if (await col.users().findOne({ usernameKey: username.toLowerCase() })) throw new HttpError(409, `The username "${username}" is taken`);
  }
  return { username, email, birthdate };
}

/** Saves a new user with a hashed password and returns it. */
async function createUser({ username, email, birthdate }, password, role, avatarUrl = null) {
  const user = {
    username,
    usernameKey: username.toLowerCase(),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    birthdate,
    avatarUrl,
    role,
    hardBanned: false,
    createdAt: new Date(),
  };
  user._id = (await col.users().insertOne(user)).insertedId;
  return user;
}

// GET /api/auth/bootstrap -> { needed }   true until the super admin has been created
router.get('/bootstrap', async (req, res) => {
  res.json({ needed: await needsBootstrap() });
});

// POST /api/auth/bootstrap  { username?, email, password, birthdate } -> { token, user }
router.post('/bootstrap', async (req, res) => {
  if (!(await needsBootstrap())) throw new HttpError(409, 'The super admin has already been set up. Sign in instead.');
  const details = await validateNewUser(req.body ?? {});
  const user = await createUser(details, req.body.password, 'superAdmin');
  await audit('user.bootstrap', user, { username: user.username });
  res.status(201).json({ token: signToken(user), user: publicUser(user, true) });
});

// POST /api/auth/register  (multipart: username?, email, password, birthdate, avatar?)
router.post('/register', imageUpload.single('avatar'), async (req, res) => {
  const avatarUrl = publicPath(req.file);
  try {
    const details = await validateNewUser(req.body ?? {});
    const user = await createUser(details, req.body.password, 'user', avatarUrl);
    await audit('user.register', user, { username: user.username });
    res.status(201).json({ token: signToken(user), user: publicUser(user, true) });
  } catch (err) {
    removeUpload(avatarUrl);
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