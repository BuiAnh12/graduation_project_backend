// config/redis.js
const { createClient } = require("redis");

const redisClient = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});


redisClient.on("error", (err) => console.error("Redis Client Error ", err));

(async () => {
  await redisClient.connect();
  console.log("Connected to Redis Cloud");
})();

module.exports = redisClient;