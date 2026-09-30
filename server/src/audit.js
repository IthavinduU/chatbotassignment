const { col } = require('./db');


const AUDIT_TYPES = [
  'user.register', 'user.passwordReset', 'user.roleChange', 'user.hardban', 'user.unban',
  'group.create', 'group.update', 'group.delete',
  'member.join', 'member.leave', 'member.ban', 'member.ageRemoved', 'member.promote',
  'channel.create', 'channel.delete', 'channel.autoDelete',
  'request.create', 'request.approve', 'request.reject', 'request.cancel',
];

async function audit(type, actor, details = {}, groupId = null) {
  await col.audit().insertOne({
    type,
    actorId: actor?._id ?? null,
    actorName: actor?.username ?? 'system',
    groupId,
    details,
    createdAt: new Date(),
  });
}

module.exports = { audit, AUDIT_TYPES };
