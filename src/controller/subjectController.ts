
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq } from 'drizzle-orm';
const subjectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
// create subject
subjectRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const { name } = body;
    const db = drizzle(c.env.myAppD1, { schema });
    const subject = await db.insert(schema.subject).values({ name }).returning();
    return c.json({ subject }, 201);
});

// get all subjects
subjectRoutes.get('/', authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema });
    const subjects = await db.query.subject.findMany(
        {
            with: {
                classesInvolved:
                {
                    columns: {
                        classRoomId: true

                    },
                    with: {
                        teacher: true
                    }


                }

            }
        }
    );
    return c.json({ subjects }, 200);
});

// delete subject
subjectRoutes.delete('/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.myAppD1, { schema });
    const subject = await db.delete(schema.subject).where(eq(schema.subject.id, Number(id))).returning();
    return c.json({ subject }, 200);
});

export default subjectRoutes;