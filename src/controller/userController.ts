// src/user.routes.ts

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import bcrypt from 'bcryptjs';
import { adminOnly, checkAuthStatus, authenticate } from '../middlewares/middleware';
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

// get all users
userRoutes.get("/", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const users = await db.query.user.findMany({
        columns: {
            id: true,
            userName: true,
            email: true,
            role: true,
            createdAt: true,
        },
        with: {
            classesTaught: true,
            enrollments: true,

        }
    })
    return c.json(users, 200)
})
// get students
userRoutes.get("/students", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const users = await db.query.user.findMany({
        where: eq(schema.user.role, "student"),
        columns: {
            id: true,
            userName: true,
            email: true,
            role: true,
            createdAt: true,
        },
        with: {
            enrollments: {
                columns: {

                },
                with: {
                    classRoom: {
                        columns: {
                            name: true,

                            createdAt: true,
                        },
                        with: {
                            classSubjects: {
                                columns: {
                                    subjectId: true,
                                    teacherId: true,
                                },
                                with: {
                                    subject: {
                                        columns: {
                                            name: true,
                                            createdAt: true,
                                        },
                                    },
                                    teacher: {
                                        columns: {
                                            userName: true,
                                            email: true,
                                            role: true,
                                            createdAt: true,
                                        },
                                    },
                                },
                            }
                        }
                    },
                },
            },
        }
    })
    return c.json(users, 200)
})

// get teachers
userRoutes.get("/teachers", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const users = await db.query.user.findMany({
        where: eq(schema.user.role, "teacher"),
        columns: {
            id: true,
            userName: true,
            email: true,
            role: true,
            createdAt: true,
        },
        with: {
            classesTaught: {
                columns: {

                },
                with: {
                    classRoom: {
                        columns: {
                            name: true,
                            createdAt: true,
                        },
                    },
                    subject: {
                        columns: {
                            name: true,
                            createdAt: true,
                        },
                    },
                },
            },

        }
    })
    return c.json(users, 200)
})

// get admin with their schools
userRoutes.get("/admin", async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })

    // Use relational query to get admins with their schools
    const admins = await db.query.user.findMany({
        where: eq(schema.user.role, "admin"),
        columns: {
            id: true,
            userName: true,
            email: true,
            role: true,
            createdAt: true,
            password: false, // Exclude password from response
        },
        with: {
            schools: true,
        }

    });

    return c.json(admins, 200)
})

userRoutes.delete("/:id", authenticate, adminOnly, async (c) => {
    const db = drizzle(c.env.myAppD1, { schema })
    const idParam = c.req.param("id")
    const id = Number(idParam)

    if (!id || isNaN(id)) {
        return c.json({ error: "Invalid user ID" }, 400)
    }
    const user = await db.select().from(schema.user).where(eq(schema.user.id, id))

    if (!user) {
        return c.json({ error: "User not found" }, 404)
    }

    const userToDelete = await db.select({
        id: schema.user.id,
        role: schema.user.role,
    }).from(schema.user).where(eq(schema.user.id, id))
    if (userToDelete.length === 0) {
        return c.json({ error: "User not found" }, 404)
    } else if (userToDelete[0].role === "admin") {
        return c.json({ error: "Admin cannot be deleted" }, 400)
    } else {
        await db.delete(schema.user).where(eq(schema.user.id, id)).returning()
    }
    return c.json({ message: "User deleted successfully", userToDelete }, 200)
})



export default userRoutes;