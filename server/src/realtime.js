// Holds the Socket.io server so REST routes can push live updates
let io = null;
const onlineCounts = new Map(); // userId -> number of open sockets (tabs)

// Store and read the Socket.io server
const setIo = (server) => (io = server);
const getIo = () => io;

// Sends an event to each user's private room
function toUsers(userIds, event, payload = {}) {
  if (!io) return;
  for (const id of userIds) io.to(`user:${id}`).emit(event, payload);
}

// Sends an event to every signed-in super admin
function toSupers(event, payload = {}) {
  io?.to("superadmins").emit(event, payload);
}

// Tells every member of a group (and any extra users) to reload their groups
function groupChanged(group, extraUserIds = []) {
  toUsers([...group.memberIds, ...extraUserIds], "groups:changed", {
    groupId: String(group._id),
  });
}

// Removes a user's sockets from the given chatroom rooms (after a ban, leave or removal)
function kickFromChannels(userId, channelIds) {
  if (!io || channelIds.length === 0) return;
  io.in(`user:${userId}`).socketsLeave(channelIds.map((id) => `channel:${id}`));
}

// Counts one more open connection for this user
function markOnline(userId) {
  onlineCounts.set(userId, (onlineCounts.get(userId) ?? 0) + 1);
}

// Counts one fewer; the user is offline once all their tabs are closed
function markOffline(userId) {
  const n = (onlineCounts.get(userId) ?? 1) - 1;
  if (n <= 0) onlineCounts.delete(userId);
  else onlineCounts.set(userId, n);
}

// Sends everyone the list of online user ids
function broadcastPresence() {
  io?.emit("presence", [...onlineCounts.keys()]);
}

module.exports = {
  setIo,
  getIo,
  toUsers,
  toSupers,
  groupChanged,
  kickFromChannels,
  markOnline,
  markOffline,
  broadcastPresence,
  onlineCounts,
};