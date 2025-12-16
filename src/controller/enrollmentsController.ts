import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { aliasedTable, and, eq } from 'drizzle-orm';

const enrollmentsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
// enroll student in class
enrollmentsRoutes.post("/enroll", authenticate, adminOnly, async (c) => {
    const body: { studentId: number; classRoomId: number } = await c.req.json();
    const { studentId, classRoomId } = body;

    const classRoom = await drizzle(c.env.myAppD1).select().from(schema.classRoom).where(eq(schema.classRoom.id, classRoomId));
    const student = await drizzle(c.env.myAppD1).select().from(schema.user).where(eq(schema.user.id, studentId));
    if (!student.length || !classRoom.length) {
        return c.json({ message: "No student or class found" }, 404);
    }
    if (student[0].role !== "student") {
        return c.json({ message: "Student not found" }, 404);
    }
    const enrollment = await drizzle(c.env.myAppD1).insert(schema.enrollments).values({
        studentId,
        classRoomId
    }).returning();
    return c.json(enrollment);
});

// get all enrollments
enrollmentsRoutes.get("/all", authenticate, adminOnly, async (c) => {
    const teacher = aliasedTable(schema.user, 'teacher');
    const admin = aliasedTable(schema.user, 'admin');
    const db = drizzle(c.env.myAppD1, { schema })

    const connections = await db.query.enrollments.findMany({
        columns: {

        },
        with: {
            classRoom: {
                with: {
                    studentGrades:
                    {
                        columns: {
                            id: true,
                            score: true,
                            type: true,
                            dateRecorded: true,
                        },
                        with: {
                            student: true,

                        }
                    },
                }
            }
        }
    })
    return c.json(connections);
});

export default enrollmentsRoutes;