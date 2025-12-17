import { Context, Next } from "hono";
import { verifyToken } from "../utils/jwt";
import type { Env, Variables } from "../index";

type UserPayload = { id: number; email: string; role: string };

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const secret = c.env.JWT_SECRET;

    if (!secret) {
        return c.json({ error: 'Server configuration error' }, 500);
    }

    const result = await verifyToken(token, secret);

    if (!result.valid || !result.payload) {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Attach user payload to context
    c.set('user', result.payload as UserPayload);
    return next();
};

export const adminOnly = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const currentUser = c.get('user');
    if (!currentUser || currentUser?.role !== 'admin') {
        return c.json({ error: 'Admin only' }, 403);
    }
    console.log(currentUser);
    return next();
}

export const developerOnly = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const currentUser = c.get('user');
    if (!currentUser || currentUser?.role !== 'admin') {
        return c.json({ error: 'Developer only' }, 403);
    }
    console.log(currentUser);
    return next();
}

