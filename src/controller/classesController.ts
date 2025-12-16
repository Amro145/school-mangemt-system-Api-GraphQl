import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq } from 'drizzle-orm';

const classesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
//  Create class 
classesRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { name, schoolId } = body;
    // Verify that the referenced school exists to avoid FK constraint errors
    const existingSchool = await db.query.school.findFirst({ where: eq(schema.school.id, schoolId) });
    if (!existingSchool) {
        return c.json({ error: 'School not found' }, 404);
    }
    const classRoom = await db.insert(schema.classRoom).values({ name, schoolId }).returning();
    return c.json({ classRoom }, 201);
});

// get all classes
classesRoutes.get('/', authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const classes = await db.query.classRoom.findMany({
        columns: {
            name: true,
            id: true,
            createdAt: true,
        },
        with: {
            school: true,
            classSubjects: {
                columns: {

                },
                with: {
                    subject: true,
                    teacher: true
                }
            }
        }
    });
    return c.json({ classes }, 200);
});
// delete class
classesRoutes.delete('/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.myAppD1, { schema })
    const classRoom = await db.delete(schema.classRoom).where(eq(schema.classRoom.id, Number(id))).returning();
    return c.json({ classRoom }, 200);
})


export default classesRoutes