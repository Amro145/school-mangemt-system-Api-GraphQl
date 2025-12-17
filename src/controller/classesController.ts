import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate, developerOnly } from '../middlewares/middleware';
import { eq, inArray } from 'drizzle-orm';

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
// get Admin classes
classesRoutes.get('/', authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const currentUser = c.get('user');
    const adminSchools = await db.query.school.findMany({ where: eq(schema.school.adminId, currentUser.id) });
    const schoolIds = adminSchools.map((school) => school.id);
    const classes = await db.query.classRoom.findMany(
        { where: inArray(schema.classRoom.schoolId, schoolIds) },
    );
    return c.json(classes, 200);
})
// get Single class
classesRoutes.get('/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    const db = drizzle(c.env.myAppD1, { schema })
    const classRoom = await db.query.classRoom.findFirst({
        where: eq(schema.classRoom.id, Number(id)),
        with: {
            school: true,
            classSubjects: {
                columns: {
                },
                with: {
                    subject: true,
                    teacher: true
                }
            },
            enrollments: {
                columns: {
                },
                with: {
                    student: true
                }
            }
        }
    });
    if (!classRoom || classRoom.school.adminId !== currentUser.id) {
        return c.json({ error: "Class not found or access denied" }, 404);
    }
    return c.json({ classRoom }, 200);
})
// delete class
classesRoutes.delete('/delete/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.myAppD1, { schema })
    const classRoom = await db.delete(schema.classRoom).where(eq(schema.classRoom.id, Number(id))).returning();
    return c.json({ classRoom }, 200);
})


export default classesRoutes