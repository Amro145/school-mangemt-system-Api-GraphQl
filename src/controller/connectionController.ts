import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate } from '../middlewares/middleware';
import { aliasedTable, and, eq } from 'drizzle-orm';

const connectionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
// connect between class and subject
connectionRoutes.post('/connect', authenticate, adminOnly, async (c) => {
    const body: { classRoomId: number; subjectId: number; teacherId: number } = await c.req.json();
    const { classRoomId, subjectId, teacherId } = body;
    const classRoom = await drizzle(c.env.myAppD1).select().from(schema.classRoom).where(eq(schema.classRoom.id, classRoomId));
    const subject = await drizzle(c.env.myAppD1).select().from(schema.subject).where(eq(schema.subject.id, subjectId));
    const teacher = await drizzle(c.env.myAppD1).select().from(schema.user).where(eq(schema.user.id, teacherId));
    if (!classRoom.length || !subject.length || !teacher.length) {
        return c.json({ message: "No class, subject or teacher found" }, 404);
    }
    else if (teacher[0].role !== 'teacher') {
        return c.json({ message: "Teacher not found" }, 404);
    }
    else {
        // Check if connection already exists
        const existingConnection = await drizzle(c.env.myAppD1).select().from(schema.classSubjects).where(
            and(
                eq(schema.classSubjects.classRoomId, classRoomId),
                eq(schema.classSubjects.subjectId, subjectId)
            )
        );

        if (existingConnection.length > 0) {
            return c.json({ error: "Connection already exists between this class and subject" }, 409);
        }

        const connection = await drizzle(c.env.myAppD1).insert(schema.classSubjects).values({
            classRoomId,
            subjectId,
            teacherId
        }).returning();
        return c.json(connection);
    }
});

// disconnect between class and subject
connectionRoutes.delete('/disconnect', authenticate, adminOnly, async (c) => {
    const body: { classRoomId: number; subjectId: number; teacherId: number } = await c.req.json();
    const { classRoomId, subjectId, teacherId } = body;
    const connection = await drizzle(c.env.myAppD1).delete(schema.classSubjects)
        .where(
            and(
                eq(schema.classSubjects.classRoomId, classRoomId),
                eq(schema.classSubjects.subjectId, subjectId),
                eq(schema.classSubjects.teacherId, teacherId)
            )
        )
        .returning();

    // Return the deleted row
    if (connection.length === 0) {
        return c.json({ message: "No connection found" }, 404);
    }
    return c.json(connection);
});
// get all connections data with school name
connectionRoutes.get('/all', authenticate, async (c) => {
    const teacher = aliasedTable(schema.user, 'teacher');
    const admin = aliasedTable(schema.user, 'admin');
    const db = drizzle(c.env.myAppD1, { schema })
    const connections = await db.query.classSubjects.findMany({
        columns: {

        },
        with: {
            classRoom: {
                columns: {
                    id: true,
                    name: true,
                },
                

            },
            subject: {
                columns: {
                    id: true,
                    name: true,
                },

            },
            teacher: {
                columns: {
                    id: true,
                    userName: true,
                },

            },
        }
    })

    return c.json(connections);
});

export default connectionRoutes;
