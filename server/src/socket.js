const { Server } = require("socket.io");
const config = require("./config");
const { col, toId } = require("./db");
const { userFromToken } = require("./auth");
const realtime = require("./realtime");
const { isMember } = require("./utils");

function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigin } });
  realtime.setIo(io);

  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const uid = String(user._id);
    socket.join(`user:${uid}`);
    if (user.role === "superAdmin") socket.join("superadmins");

    realtime.markOnline(uid);
    realtime.broadcastPresence();

    const reply = (ack, body) => typeof ack === "function" && ack(body);

    async function channelForMember(channelId) {
      const channel = await col.channels().findOne({ _id: toId(channelId) });
      if (!channel) return { error: "Chatroom not found" };
      const group = await col.groups().findOne({ _id: channel.groupId });
      if (!group || !isMember(group, user._id))
        return { error: "You are not a member of this group" };
      return { channel, group };
    }

    socket.on("room:join", async ({ channelId } = {}, ack) => {
      const { channel, error } = await channelForMember(channelId);
      if (error) return reply(ack, { ok: false, error });

      const room = `channel:${channel._id}`;
      const alreadyIn = socket.rooms.has(room);
      for (const r of socket.rooms)
        if (r.startsWith("channel:") && r !== room) socket.leave(r);
      socket.join(room);
      reply(ack, { ok: true });

      if (!alreadyIn)
        socket
          .to(room)
          .emit("room:userJoined", {
            channelId: String(channel._id),
            username: user.username,
          });
    });

    socket.on("room:leave", ({ channelId } = {}) =>
      socket.leave(`channel:${channelId}`),
    );

    socket.on(
      "message:send",
      async ({ channelId, text, imageUrl } = {}, ack) => {
        const cleanText =
          typeof text === "string" ? text.trim().slice(0, 2000) : "";
        const cleanImage =
          typeof imageUrl === "string" && imageUrl.startsWith("/uploads/")
            ? imageUrl
            : null;
        if (!cleanText && !cleanImage)
          return reply(ack, { ok: false, error: "Message is empty" });

        const { channel, group, error } = await channelForMember(channelId);
        if (error) return reply(ack, { ok: false, error });

        const sender = await col.users().findOne({ _id: user._id });
        const message = {
          channelId: channel._id,
          groupId: group._id,
          userId: user._id,
          username: sender.username,
          avatarUrl: sender.avatarUrl ?? null,
          text: cleanText || null,
          imageUrl: cleanImage,
          createdAt: new Date(),
        };
        const { insertedId } = await col.messages().insertOne(message);
        message._id = insertedId;
        await col
          .channels()
          .updateOne(
            { _id: channel._id },
            { $set: { lastActivityAt: message.createdAt } },
          );

        io.to(`channel:${channel._id}`).emit("message:new", message);
        reply(ack, { ok: true });
      },
    );

    socket.on("disconnect", () => {
      realtime.markOffline(uid);
      realtime.broadcastPresence();
    });

    socket.emit("presence", [...realtime.onlineCounts.keys()]);
  });

  return io;
}

module.exports = { attachSocket };
