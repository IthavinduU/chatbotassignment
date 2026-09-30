let io = null;
const onlineCounts = new Map(); // 

const setIo = (server) => (io = server);
const getIo = () => io;

function toUsers(userIds, event, payload = {}) {
  if (!io) return;
  for (const id of userIds) io.to(`user:${id}`).emit(event, payload);
}

function toSupers(event, payload = {}) {
  io?.to("superadmins").emit(event, payload);
}

function groupChanged(group, extraUserIds = []) {
  toUsers([...group.memberIds, ...extraUserIds], "groups:changed", {
    groupId: String(group._id),
  });
} 

/*Removes a user's sockets from the given chatroom rooms*/
function kickFromChannels(userId, channelIds) {
  if (!io || channelIds.length === 0) return;
  io.in(`user:${userId}`).socketsLeave(channelIds.map((id) => `channel:${id}`));
}

function markOnline(userId) {
  onlineCounts.set(userId, (onlineCounts.get(userId) ?? 0) + 1);
}

function markOffline(userId) {
  const n = (onlineCounts.get(userId) ?? 1) - 1;
  if (n <= 0) onlineCounts.delete(userId);
  else onlineCounts.set(userId, n);
}

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
