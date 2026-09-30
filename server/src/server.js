const http = require('http');
const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');
const { attachSocket } = require('./socket');
const { seed } = require('./seed');
const { startJobs } = require('./jobs');

async function main() {
  await db.connect();
  console.log(`Connected to MongoDB (${config.dbName})`);
  await seed({ demo: config.seedDemo });

  const server = http.createServer(createApp());
  attachSocket(server);
  startJobs();

  server.listen(config.port, () => console.log(`API and sockets running at http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('Could not start the server:', err.message);
  console.error('Is MongoDB running? Check MONGO_URL in server/.env');
  process.exit(1);
});
