const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const os = require('os');

// Set test environment variables before any module loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'share_a_plate_super_secret_test_key_minimum_32_characters_long!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4'; // Faster hashing for test performance

let mongoServer;

// Start in-memory MongoDB instance before running test suites
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI_TEST = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      runtimeAdapters: { os },
    });
  }
});

// Clean up collections between individual tests
afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

// Stop in-memory MongoDB instance and close connection after all tests complete
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
