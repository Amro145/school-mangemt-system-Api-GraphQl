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
    return c.json(classRoom, 201);
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
    const id = Number(c.req.param('id'));
    const currentUser = c.get('user');

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    const db = drizzle(c.env.myAppD1, { schema })
    const classRoom = await db.query.classRoom.findFirst({
        where: eq(schema.classRoom.id, id),
        with: {
            school: true,
            classSubjects: {
                with: {
                    subject: true,
                    teacher: true
                }
            },
            enrollments: {
                with: {
                    student: true
                }
            }
        }
    });

    if (!classRoom) {
        return c.json({ error: "Resource not found" }, 404);
    }

    if (classRoom.school.adminId !== currentUser.id) {
        return c.json({ error: "Access denied: Unauthorized" }, 403);
    }

    return c.json(classRoom, 200);
})
// delete class
classesRoutes.delete('/delete/:id', authenticate, adminOnly, async (c) => {
    const id = Number(c.req.param('id'));
    const currentUser = c.get('user');

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    const db = drizzle(c.env.myAppD1, { schema })

    // Check existence and ownership first
    const classRoom = await db.query.classRoom.findFirst({
        where: eq(schema.classRoom.id, id),
        with: {
            school: true
        }
    });

    if (!classRoom) {
        return c.json({ error: "Resource not found" }, 404);
    }

    if (classRoom.school.adminId !== currentUser.id) {
        return c.json({ error: "Access denied: Unauthorized" }, 403);
    }

    const [deletedClass] = await db.delete(schema.classRoom).where(eq(schema.classRoom.id, id)).returning();
    return c.json(deletedClass, 200);
})


export default classesRoutes