import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { eq, and } from 'drizzle-orm';
const gradeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// create grade
gradeRoutes.post('/', authenticate, adminOnly, async (c) => {
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { studentId, classRoomId, subjectId, score, type } = body;

    // Validate required fields
    if (!studentId || !classRoomId || !subjectId || score === undefined) {
        return c.json({ error: "Missing required fields: studentId, classRoomId, subjectId, score" }, 400);
    }

    // Validate score range
    if (typeof score !== 'number' || score < 0 || score > 100) {
        return c.json({ error: "Score must be a number between 0 and 100" }, 400);
    }

    // Validate type if provided
    if (type && !['assignment', 'midterm', 'final'].includes(type)) {
        return c.json({ error: "Type must be one of: assignment, midterm, final" }, 400);
    }

    // Check if student exists and has student role
    const student = await db.select().from(schema.user).where(eq(schema.user.id, studentId));
    if (!student.length) {
        return c.json({ error: "Student not found" }, 404);
    }
    if (student[0].role !== 'student') {
        return c.json({ error: "User is not a student" }, 400);
    }

    // Check if class exists
    const classRoom = await db.select().from(schema.classRoom).where(eq(schema.classRoom.id, classRoomId));
    if (!classRoom.length) {
        return c.json({ error: "Class not found" }, 404);
    }

    // Check if subject exists
    const subject = await db.select().from(schema.subject).where(eq(schema.subject.id, subjectId));
    if (!subject.length) {
        return c.json({ error: "Subject not found" }, 404);
    }

    // Check if student is enrolled in the class
    const enrollment = await db.select().from(schema.enrollments).where(
        and(
            eq(schema.enrollments.studentId, studentId),
            eq(schema.enrollments.classRoomId, classRoomId)
        )
    );
    if (!enrollment.length) {
        return c.json({ error: "Student is not enrolled in this class" }, 400);
    }

    // Check if subject is taught in this class
    const classSubject = await db.select().from(schema.classSubjects).where(
        and(
            eq(schema.classSubjects.classRoomId, classRoomId),
            eq(schema.classSubjects.subjectId, subjectId)
        )
    );
    if (!classSubject.length) {
        return c.json({ error: "This subject is not taught in this class" }, 400);
    }

    const grade = await db.insert(schema.studentGrades).values({ studentId, classRoomId, subjectId, score, type }).returning()
    return c.json(grade, 201);
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
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const db = drizzle(c.env.myAppD1, { schema })
    const { studentId, classRoomId, subjectId, score, type } = body;

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    // Check if grade exists
    const existing = await db.query.studentGrades.findFirst({
        where: eq(schema.studentGrades.id, id)
    });

    if (!existing) {
        return c.json({ error: "Resource not found" }, 404);
    }

    // Validate score if provided
    if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 100)) {
        return c.json({ error: "Score must be a number between 0 and 100" }, 400);
    }

    // Validate type if provided
    if (type && !['assignment', 'midterm', 'final'].includes(type)) {
        return c.json({ error: "Type must be one of: assignment, midterm, final" }, 400);
    }

    const [grade] = await db.update(schema.studentGrades).set({ studentId, classRoomId, subjectId, score, type }).where(eq(schema.studentGrades.id, id)).returning()
    return c.json(grade, 200)
})
// delete grade
gradeRoutes.delete('/:id', authenticate, adminOnly, async (c) => {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.myAppD1, { schema })

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400);
    }

    // Check if grade exists
    const existing = await db.query.studentGrades.findFirst({
        where: eq(schema.studentGrades.id, id)
    });

    if (!existing) {
        return c.json({ error: "Resource not found" }, 404);
    }

    const [grade] = await db.delete(schema.studentGrades).where(eq(schema.studentGrades.id, id)).returning()
    return c.json(grade, 200)
})

export default gradeRoutes