
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq } from 'drizzle-orm';
const schoolRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
// create school
schoolRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { name, adminId } = body;
    const school = await db.insert(schema.school).values({ name, adminId }).returning()
    return c.json({ school }, 201);
});
// get all schools
schoolRoutes.get('/', async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const schools = await db.query.school.findMany({
        with: {
            admin: true,
        },
    })
    return c.json(schools, 200)
})
schoolRoutes.delete("/:id", authenticate, adminOnly, async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.myAppD1, { schema })
    const school = await db.delete(schema.school).where(eq(schema.school.id, Number(id))).returning()
    return c.json(school, 200)
})

export default schoolRoutes;