import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import bcrypt from 'bcryptjs';
import { adminOnly, authenticate, developerOnly } from '../middlewares/middleware';
import { generateToken } from '../utils/jwt';

const userRoutesDeveloper = new Hono<{ Bindings: Env; Variables: Variables }>();

// get all users to Developer
userRoutesDeveloper.get("/", authenticate, developerOnly, async (c) => {
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
// get students to Developer
userRoutesDeveloper.get("/students", authenticate, developerOnly, async (c) => {
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

// get teachers to Developer
userRoutesDeveloper.get("/teachers", authenticate, developerOnly, async (c) => {
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

// get admin with their schools to Developer
userRoutesDeveloper.get("/admin", authenticate, developerOnly, async (c) => {
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
            schoolsManaged: {
                with: {
                    classes: true,
                },
            },
        }

    });

    return c.json(admins, 200)
})

export default userRoutesDeveloper
