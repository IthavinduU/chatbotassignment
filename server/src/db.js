const { MongoClient, ObjectId } = require("mongodb");
const config = require("./config");

// One shared connection for the whole app
let client = null;
let db = null;

// Connects to MongoDB and makes sure the indexes exist
async function connect(url = config.mongoUrl, dbName = config.dbName) {
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes();
  return db;
}

// Unique usernames and emails, plus indexes for common lookups
async function ensureIndexes() {
  await db
    .collection("users")
    .createIndex({ usernameKey: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("channels").createIndex({ groupId: 1 });
  await db.collection("messages").createIndex({ channelId: 1, createdAt: -1 });
  await db.collection("requests").createIndex({ status: 1, type: 1 });
  await db.collection("audit").createIndex({ createdAt: -1 });
}

// Closes the connection (used by the tests)
async function close() {
  await client?.close();
  client = null;
  db = null;
}

// Returns the database, or fails if connect() hasn't run yet
function getDb() {
  if (!db) throw new Error("Database not connected");
  return db;
}

// Collection shortcuts: col.users(), col.groups(), ...
const col = {
  users: () => getDb().collection("users"),
  groups: () => getDb().collection("groups"),
  channels: () => getDb().collection("channels"),
  messages: () => getDb().collection("messages"),
  requests: () => getDb().collection("requests"),
  audit: () => getDb().collection("audit"),
};

// Converts a string to an ObjectId, or returns null if it isn't a valid id
function toId(value) {
  const s = String(value ?? "");
  return /^[a-f0-9]{24}$/i.test(s) ? new ObjectId(s) : null;
}

module.exports = { connect, close, getDb, col, toId, ObjectId };