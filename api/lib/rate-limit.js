const rateLimit = new Map();

// Allow 20 requests per 1 minute window per IP
const WINDOW_MS = 60 * 1000;
const MAX_REQS = 20;

export function checkRateLimit(req) {
    // Get IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    const now = Date.now();
    const record = rateLimit.get(ip) || { count: 0, startTime: now };

    // Reset if window passed
    if (now - record.startTime > WINDOW_MS) {
        record.count = 1;
        record.startTime = now;
    } else {
        record.count++;
    }

    rateLimit.set(ip, record);

    // Clean up old entries periodically (simple garbage collection)
    if (rateLimit.size > 5000) {
        for (const [key, val] of rateLimit.entries()) {
            if (now - val.startTime > WINDOW_MS) rateLimit.delete(key);
        }
    }

    return record.count <= MAX_REQS;
}
