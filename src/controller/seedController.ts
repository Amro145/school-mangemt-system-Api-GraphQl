import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { seed } from '../seed';

const seedController = new Hono<{ Bindings: Env; Variables: Variables }>();

seedController.post('/', async (c) => {
    const db = drizzle(c.env.myAppD1, { schema });

    try {
        const result = await seed(db);
        return c.json(result, 200);

    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});

export default seedController;
