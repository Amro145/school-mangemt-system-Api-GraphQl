
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
    return c.json(school, 201);
});
// get all schools
schoolRoutes.get('/', async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const schools = await db.query.school.findMany({
        with: {
            admin: true,
            classes: {
                with: {

                    classSubjects: {
                        columns: {

                        },
                        with: {
                            teacher: true,
                            subject: true,
                        }
                    },

                }
            }
        },
    })
    return c.json(schools, 200)
})
schoolRoutes.delete("/:id", authenticate, adminOnly, async (c) => {
    const id = Number(c.req.param("id"));
    const currentUser = c.get('user');

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    const db = drizzle(c.env.myAppD1, { schema })

    // Check existence and ownership
    const school = await db.query.school.findFirst({
        where: eq(schema.school.id, id)
    });

    if (!school) {
        return c.json({ error: "Resource not found" }, 404);
    }

    if (school.adminId !== currentUser.id) {
        return c.json({ error: "Access denied: Unauthorized" }, 403);
    }

    const [deletedSchool] = await db.delete(schema.school).where(eq(schema.school.id, id)).returning()
    return c.json(deletedSchool, 200)
})

export default schoolRoutes;