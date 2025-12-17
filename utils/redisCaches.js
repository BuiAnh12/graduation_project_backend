// utils/redisCache.js
const redisClient = require("../config/redis");

const DEFAULT_TTL = 3600; // seconds

const redisCache = {
  /**
   * Get a cached value by key.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Redis GET error for key "${key}":`, error);
      return null;
    }
  },

  /**
   * Set a value to cache with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} ttl
   */
  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      await redisClient.set(key, JSON.stringify(value), { EX: ttl });
      console.log(`✅ Redis SET: ${key}`);
    } catch (error) {
      console.error(`Redis SET error for key "${key}":`, error);
    }
  },

  /**
   * Delete cache by key
   * @param {string} key
   */
  async del(key) {
    try {
      await redisClient.del(key);
      console.log(`🗑️ Redis DEL: ${key}`);
    } catch (error) {
      console.error(`Redis DEL error for key "${key}":`, error);
    }
  },

  /**
   * Delete cache by pattern
   * @param {string} pattern
   */
  async delByPattern(pattern) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = nextCursor;

        if (keys.length) {
          await redisClient.del(...keys);
          console.log(`🧹 Redis DEL pattern match: ${pattern} — deleted ${keys.length} keys`);
        }
      } while (cursor !== "0");
    } catch (error) {
      console.error(`Redis DEL pattern error "${pattern}":`, error);
    }
  },
};

const CACHE_TTL = {
  LONG: 3600,      // 1 hour (Categories)
  MEDIUM: 600,     // 10 minutes (Store Lists, Info)
  SHORT: 300       // 5 minutes (Ratings)
};


module.exports = {
  redisCache,
  CACHE_TTL
};


