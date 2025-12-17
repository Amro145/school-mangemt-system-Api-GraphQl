
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq, inArray } from 'drizzle-orm';
const subjectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
// create subject
subjectRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const { name } = body;
    const db = drizzle(c.env.myAppD1, { schema });
    const subject = await db.insert(schema.subject).values({ name }).returning();
    return c.json(subject, 201);
});

// get all subjects to admin by classId 
subjectRoutes.get('/admin/:classId', authenticate, adminOnly, async (c) => {
    const classId = Number(c.req.param('classId'));

    if (isNaN(classId)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    const db = drizzle(c.env.myAppD1, { schema });

    // Verify class exists/find subjects
    const classSubjectData = await db.query.classRoom.findFirst({
        where: eq(schema.classRoom.id, classId),
        columns: {},
        with: {
            classSubjects: {
                columns: {},
                with: {
                    subject: true,
                    teacher: true
                }
            }
        }
    });

    if (!classSubjectData) {
        return c.json({ error: "Resource not found" }, 404);
    }

    return c.json(classSubjectData, 200);
});

// delete subject
subjectRoutes.delete('/:id', authenticate, adminOnly, async (c) => {
    const id = Number(c.req.param('id'));

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    const db = drizzle(c.env.myAppD1, { schema });

    const existing = await db.query.subject.findFirst({
        where: eq(schema.subject.id, id)
    })

    if (!existing) {
        return c.json({ error: "Resource not found" }, 404);
    }

    const [subject] = await db.delete(schema.subject).where(eq(schema.subject.id, id)).returning();
    return c.json(subject, 200);
});

export default subjectRoutes;