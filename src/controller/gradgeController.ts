import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq } from 'drizzle-orm';
const gradeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// create grade
gradeRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { studentId, classRoomId, subjectId, score, type } = body;
    const grade = await db.insert(schema.studentGrades).values({ studentId, classRoomId, subjectId, score, type }).returning()
    return c.json({ grade }, 201);
});
// get all grades
gradeRoutes.get('/', async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const grades = await db.query.studentGrades.findMany(
        {
            columns: {
                id: true,
                score: true,
                type: true,
            },
            with: {
                classRoom: {
                    columns: {
                        id: true,
                        name: true,
                    }
                },
                subject: true,
                student: {
                    columns: {
                        id: true,
                        userName: true,
                        email: true,
                        role: true,
                    },
                    with: {
                        enrollments: true,
                    }
                },
            }
        },
    )
    return c.json(grades, 200)
})
// update grade
gradeRoutes.put('/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { studentId, classRoomId, subjectId, score, type } = body;
    const grade = await db.update(schema.studentGrades).set({ studentId, classRoomId, subjectId, score, type }).where(eq(schema.studentGrades.id, Number(id))).returning()
    return c.json({ grade }, 200)
})
// delete grade
gradeRoutes.delete('/:id', authenticate, adminOnly, async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.myAppD1, { schema })
    const grade = await db.delete(schema.studentGrades).where(eq(schema.studentGrades.id, Number(id))).returning()
    return c.json({ grade }, 200)
})

export default gradeRoutes