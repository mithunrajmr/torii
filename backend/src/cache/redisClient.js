// backend/src/cache/redisClient.js
// Upstash Redis REST client wrapper with local mock fallback.

import { Redis } from '@upstash/redis';

let redis = null;
const mockStore = new Map();
const mockExpiry = new Map();

if (process.env.REDIS_URL && process.env.REDIS_TOKEN) {
  redis = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
  });
} else {
  console.info('[redisClient] Running with Local Dev Memory Mock (No REDIS_URL provided)');
}

function cleanExpiredKey(key) {
  const expiry = mockExpiry.get(key);
  if (expiry && Date.now() > expiry) {
    mockStore.delete(key);
    mockExpiry.delete(key);
  }
}

export async function set(key, value, options = {}) {
  if (redis) {
    if (options.ex !== undefined) {
      return redis.set(key, value, { ex: options.ex });
    }
    return redis.set(key, value);
  }

  mockStore.set(key, String(value));
  if (options.ex !== undefined) {
    mockExpiry.set(key, Date.now() + options.ex * 1000);
  } else {
    mockExpiry.delete(key);
  }
  return 'OK';
}

export async function get(key) {
  if (redis) {
    // Upstash Redis REST client JSON-parses values on the way out.
    // A stored string "123456" comes back as the number 123456.
    // Always coerce to string (null stays null) so callers get predictable types.
    const val = await redis.get(key);
    return val == null ? null : String(val);
  }

  cleanExpiredKey(key);
  return mockStore.has(key) ? mockStore.get(key) : null;
}

export async function del(...keys) {
  if (redis) {
    return redis.del(...keys);
  }

  let count = 0;
  for (const key of keys) {
    if (mockStore.has(key)) {
      mockStore.delete(key);
      mockExpiry.delete(key);
      count++;
    }
  }
  return count;
}

export async function ttl(key) {
  if (redis) {
    return redis.ttl(key);
  }

  cleanExpiredKey(key);
  if (!mockStore.has(key)) return -2;
  const expiry = mockExpiry.get(key);
  if (!expiry) return -1;
  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

export async function incrWithExpiry(key, ex) {
  if (redis) {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ex);
    const results = await pipeline.exec();
    return results[0];
  }

  cleanExpiredKey(key);
  const current = Number(mockStore.get(key) || 0) + 1;
  mockStore.set(key, String(current));
  mockExpiry.set(key, Date.now() + ex * 1000);
  return current;
}

export default { set, get, del, ttl, incrWithExpiry };
