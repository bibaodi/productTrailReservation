'use strict';

function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const requests = new Map();
  const cleanupTimer = setInterval(() => {
    const currentTime = now();
    for (const [key, timestamps] of requests) {
      const recent = timestamps.filter((timestamp) => currentTime - timestamp < windowMs);
      if (recent.length) requests.set(key, recent);
      else requests.delete(key);
    }
  }, Math.min(windowMs, 10 * 60 * 1000));
  cleanupTimer.unref();

  return {
    allow(key) {
      const currentTime = now();
      const recent = (requests.get(key) || []).filter(
        (timestamp) => currentTime - timestamp < windowMs
      );
      if (recent.length >= limit) {
        requests.set(key, recent);
        return false;
      }
      recent.push(currentTime);
      requests.set(key, recent);
      return true;
    },
    close() {
      clearInterval(cleanupTimer);
    },
  };
}

module.exports = { createRateLimiter };
