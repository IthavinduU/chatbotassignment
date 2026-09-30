// Deletes chatrooms that have had no messages for CHANNEL_INACTIVE_DAYS days. Runs hourly.
const config = require('./config');
const { col } = require('./db');
const svc = require('./services');

async function deleteInactiveChannels(days = config.channelInactiveDays, now = new Date()) {
  if (!days || days <= 0) return 0;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const stale = await col.channels().find({ lastActivityAt: { $lt: cutoff } }).toArray();
  for (const channel of stale) {
    const group = await col.groups().findOne({ _id: channel.groupId });
    await svc.deleteChannel(channel, group, null, 'channel.autoDelete');
  }
  if (stale.length) console.log(`Deleted ${stale.length} inactive chatroom(s)`);
  return stale.length;
}

function startJobs() {
  const run = () => deleteInactiveChannels().catch((err) => console.error('Cleanup failed:', err.message));
  run();
  return setInterval(run, 60 * 60 * 1000);
}

module.exports = { deleteInactiveChannels, startJobs };
