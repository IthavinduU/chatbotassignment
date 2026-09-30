const THEMES = ['blue', 'red', 'yellow'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sameId = (a, b) => String(a) === String(b);
const hasId = (list = [], id) => list.some((x) => sameId(x, id));

function ageOn(birthdate, today = new Date()) {
  const b = new Date(birthdate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function isMember(group, userId) {
  return hasId(group.memberIds, userId);
}

function isGroupAdmin(group, user) {
  return user.role !== 'user' && hasId(group.adminIds, user._id);
}

function cleanName(value, max = 40) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 1 && name.length <= max ? name : null;
}

// "Assignment Help" -> "assignment-help"
function channelSlug(value) {
  const name = cleanName(value, 30);
  return name ? name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') || null : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Never send password hashes or reset tokens to the client. */
function publicUser(user, full = false) {
  if (!user) return null;
  const base = { _id: user._id, username: user.username, avatarUrl: user.avatarUrl ?? null, role: user.role };
  if (!full) return base;
  return {
    ...base,
    email: user.email,
    birthdate: user.birthdate,
    hardBanned: !!user.hardBanned,
    hardBanReason: user.hardBanReason ?? null,
    createdAt: user.createdAt,
  };
}

module.exports = {
  THEMES, HttpError, sameId, hasId, ageOn, isMember, isGroupAdmin, cleanName, channelSlug, escapeRegex, publicUser,
};
