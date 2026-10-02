// Group theme colours a group admin can pick from
const THEMES = ['blue', 'red', 'yellow'];

// Error with an HTTP status code, sent to the client by the error handler
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Compare ids as strings (works for ObjectIds and plain strings)
const sameId = (a, b) => String(a) === String(b);
// True if the list contains the id
const hasId = (list = [], id) => list.some((x) => sameId(x, id));

// Age in whole years on a given day
function ageOn(birthdate, today = new Date()) {
  const b = new Date(birthdate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  // Birthday not reached yet this year
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

// True if the user is a member of the group
function isMember(group, userId) {
  return hasId(group.memberIds, userId);
}

// True if the user is an admin of this group (and not a plain member)
function isGroupAdmin(group, user) {
  return user.role !== 'user' && hasId(group.adminIds, user._id);
}

// Trims and tidies a name; returns null if empty or too long
function cleanName(value, max = 40) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 1 && name.length <= max ? name : null;
}

// Turns a chatroom name into a slug, e.g. "Assignment Help" -> "assignment-help"
function channelSlug(value) {
  const name = cleanName(value, 30);
  return name ? name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') || null : null;
}

// Escapes special characters so text can be used safely in a regex
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Safe user data for the client: never includes password hashes or reset tokens
function publicUser(user, full = false) {
  if (!user) return null;
  const base = { _id: user._id, username: user.username, avatarUrl: user.avatarUrl ?? null, role: user.role };
  if (!full) return base;
  // Extra details for the user themselves and super admins
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