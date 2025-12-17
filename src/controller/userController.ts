// src/user.routes.ts

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import bcrypt from 'bcryptjs';
import { adminOnly, authenticate, developerOnly } from '../middlewares/middleware';
import { generateToken } from '../utils/jwt';

const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();



// create Users
userRoutes.post("/signup", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const { userName, email, password, role } = await c.req.json()
    if (!userName || !email || !password || !role) {
        return c.json({ error: "Missing required fields" }, 400)
    }
    // Fix: Proper type checking for role
    if (!['student', 'teacher', 'admin'].includes(role)) {
        return c.json({ error: "Invalid role" }, 400)
    }
    const existingUser = await db.query.user.findFirst({
        where: eq(schema.user.email, email),
    });
    if (existingUser) {
        return c.json({ error: "Email already exists" }, 400)
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const [user] = await db.insert(schema.user).values({ userName, email, password: hashedPassword, role }).returning()

    // Fix: Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    return c.json(userWithoutPassword, 201)
})
// login
userRoutes.post("/login", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const { email, password } = await c.req.json()
    if (!email || !password) {
        return c.json({ error: "Missing required fields" }, 400)
    }
    const user = await db.query.user.findFirst({
        where: eq(schema.user.email, email),
    });
    if (!user) {
        return c.json({ error: "User not found" }, 404)
    }
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
        return c.json({ error: "Invalid password" }, 401)
    }
    const payload = {
        id: user.id,
        role: user.role,
        userName: user.userName
    };
    const token = await generateToken(payload, c.env.JWT_SECRET);
    return c.json({ user, token }, 200)
})
// delete user
// delete user
userRoutes.delete("/delete/:id", authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const id = Number(c.req.param("id"))

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400)
    }

    const user = await db.query.user.findFirst({
        where: eq(schema.user.id, id)
    })

    if (!user) {
        return c.json({ error: "Resource not found" }, 404)
    }

    if (user.role === "admin") {
        return c.json({ error: "Access denied: Unauthorized" }, 403)
    }

    const [deletedUser] = await db.delete(schema.user).where(eq(schema.user.id, id)).returning()
    return c.json({ message: "User deleted successfully", user: deletedUser }, 200)
})
// get Profile
userRoutes.get("/admin/profile", authenticate, async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
        return c.json({ error: "Resource not found" }, 404)
    }
    return c.json(currentUser, 200)
})
// get Techers to admin
userRoutes.get("/admin/teachers", authenticate, adminOnly, async (c) => {
    const currentUser = c.get('user');
    const db = drizzle(c.env.myAppD1, { schema });

    const teachers = await db.select({
        id: schema.user.id,
        userName: schema.user.userName,
        email: schema.user.email,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        classesTaught: {
            classRoomId: schema.classSubjects.classRoomId,
            subjectId: schema.classSubjects.subjectId,
            teacherId: schema.classSubjects.teacherId,
        },
    })
        .from(schema.user)
        .innerJoin(schema.classSubjects, eq(schema.user.id, schema.classSubjects.teacherId))
        .innerJoin(schema.classRoom, eq(schema.classSubjects.classRoomId, schema.classRoom.id))
        .innerJoin(schema.school, eq(schema.classRoom.schoolId, schema.school.id))
        .where(and(
            eq(schema.user.role, "teacher"),
            eq(schema.school.adminId, currentUser.id)
        ))
        .groupBy(schema.user.id);

    return c.json(teachers, 200);
})
//get signale Teacher to admin
userRoutes.get("/admin/teacher/:id", authenticate, adminOnly, async (c) => {
    const currentUser = c.get('user');
    const db = drizzle(c.env.myAppD1, { schema });
    const id = Number(c.req.param("id"))

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400)
    }

    const teacher = await db.select(
        {
            id: schema.user.id,
            userName: schema.user.userName,
            email: schema.user.email,
            role: schema.user.role,
            createdAt: schema.user.createdAt,
            classRoom: schema.classRoom,
            subject: schema.subject,
        }
    ).from(schema.user)
        .innerJoin(schema.classSubjects, eq(schema.user.id, schema.classSubjects.teacherId))
        .innerJoin(schema.classRoom, eq(schema.classSubjects.classRoomId, schema.classRoom.id))
        .innerJoin(schema.school, eq(schema.classRoom.schoolId, schema.school.id))
        .innerJoin(schema.subject, eq(schema.classSubjects.subjectId, schema.subject.id))
        .where(and(
            eq(schema.user.role, "teacher"),
            eq(schema.user.id, id),
            eq(schema.school.adminId, currentUser.id)
        ))
        .groupBy(schema.user.id);

    if (!teacher || teacher.length === 0) {
        return c.json({ error: "Resource not found" }, 404)
    }
    return c.json(teacher, 200)
})
// get students to to admin by classRoomId 
userRoutes.get("/admin/students/:classRoomId", authenticate, adminOnly, async (c) => {
    const currentUser = c.get('user');
    const db = drizzle(c.env.myAppD1, { schema });
    const classRoomId = Number(c.req.param("classRoomId"))

    if (isNaN(classRoomId)) {
        return c.json({ error: "Invalid request parameters" }, 400)
    }
    const students = await db.select({
        id: schema.user.id,
        userName: schema.user.userName,
        email: schema.user.email,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        classRoomId: schema.enrollments.classRoomId,
    }).from(schema.user)
        .innerJoin(schema.enrollments, eq(schema.user.id, schema.enrollments.studentId))
        .innerJoin(schema.classRoom, eq(schema.enrollments.classRoomId, schema.classRoom.id))
        .innerJoin(schema.school, eq(schema.classRoom.schoolId, schema.school.id))
        .where(and(
            eq(schema.user.role, "student"),
            eq(schema.enrollments.classRoomId, classRoomId),
            eq(schema.school.adminId, currentUser.id)
        ))
        .groupBy(schema.user.id);

    return c.json(students, 200);
})
// get single student to admin
userRoutes.get("/admin/student/:id", authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema });
    const id = Number(c.req.param("id"))

    if (isNaN(id)) {
        return c.json({ error: "Invalid request parameters" }, 400)
    }

    const student = await db.query.user.findFirst({
        where: and(
            eq(schema.user.role, "student"),
            eq(schema.user.id, id),
        ),
        with: {
            studentGrades: {
                with: {
                    classRoom: {
                        with: {
                            school: true,
                        },
                    },
                    subject: true,
                }
            },
        }
    })

    if (!student) {
        return c.json({ error: "Resource not found" }, 404)
    }
    return c.json(student, 200)
})



export default userRoutes;