require('dotenv').config();
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST, // Redis host
    port: process.env.REDIS_PORT // Redis port
  },
  password: process.env.REDIS_PASSWORD, // Redis password (if applicable)
});

// Handle connection events
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Open connection
redisClient.connect().catch(console.error);

// Export the Redis client for use in other files
module.exports = redisClient;
