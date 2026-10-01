process.env.CHANNEL_INACTIVE_DAYS = '0';
const request = require('supertest');
const db = require('../src/db');
const { createApp } = require('../src/app');
const { seed } = require('../src/seed');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const TEST_DB = process.env.TEST_DB_NAME || 'fabulari_test';

async function resetDatabase() {
  await db.connect(MONGO_URL, TEST_DB);
  await db.getDb().dropDatabase();
  await db.close();
  await db.connect(MONGO_URL, TEST_DB); 
  await seed({ demo: false }); 
}

function makeClient(app) {
  const api = request(app);
  return {
    api,
    async register(username, birthdate = '2000-01-01') {
      const res = await api.post('/api/auth/register')
        .send({ username, email: `${username}@test.local`, password: 'secret', birthdate });
      if (res.status !== 201) throw new Error(`register ${username} failed: ${res.body.error}`);
      return { token: res.body.token, user: res.body.user };
    },
    async login(login, password) {
      const res = await api.post('/api/auth/login').send({ login, password });
      return res.body.token;
    },
    as(token) {
      const auth = (r) => r.set('Authorization', `Bearer ${token}`);
      return {
        get: (url) => auth(api.get(url)),
        post: (url, body = {}) => auth(api.post(url)).send(body),
        patch: (url, body = {}) => auth(api.patch(url)).send(body),
        delete: (url) => auth(api.delete(url)),
      };
    },
  };
}

module.exports = { db, createApp, resetDatabase, makeClient };
