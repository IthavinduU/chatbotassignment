const jwt = require('jsonwebtoken');
const config = require('./config');
const { col, toId } = require('./db');

/** Creates a sign-in token for a user, valid for 8 hours. */
function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '8h' });
}

/** Returns the user for a valid token, or null. Hard-banned users are always rejected. */
async function userFromToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await col.users().findOne({ _id: toId(sub) });
    return user && !user.hardBanned ? user : null;
  } catch {
    return null;
  }
}

/** Checks the Bearer token on a request and puts the user on req.user. */
async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Please sign in again' });
  req.user = user;
  next();
}

/** Only lets super admins continue. */
function requireSuper(req, res, next) {
  if (req.user.role !== 'superAdmin') return res.status(403).json({ error: 'Only super admins can do that' });
  next();
}

/** Super admins have no direct contact with users, so they are kept out of group features. */
function forbidSuper(req, res, next) {
  if (req.user.role === 'superAdmin') return res.status(403).json({ error: 'Super admins do not take part in groups' });
  next();
}

module.exports = { signToken, userFromToken, authenticate, requireSuper, forbidSuper };