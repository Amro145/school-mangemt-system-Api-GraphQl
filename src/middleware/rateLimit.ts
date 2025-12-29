import { Context, Next } from 'hono';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxRequests = 100;

    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
        record.count++;
        if (record.count > maxRequests) {
            return c.json({ error: "Too Many Requests - Rate limit exceeded" }, 429);
        }
    }
    await next();
};
