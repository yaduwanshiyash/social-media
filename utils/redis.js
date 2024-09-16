const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
  socket: {
    host: 'redis-15024.c301.ap-south-1-1.ec2.redns.redis-cloud.com', // Redis host
    port: 15024 // Redis port
  },
  password: '5b3ThDnT2Aimc7FLG0h7BSwD0Y8w7H6z', // Redis password (if applicable)
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
