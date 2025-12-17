import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index';
import { adminOnly, authenticate, developerOnly } from '../middlewares/middleware';
import { eq } from 'drizzle-orm';

const classesRoutesDeveloper = new Hono<{ Bindings: Env; Variables: Variables }>();
// get all classes
classesRoutesDeveloper.get('/', authenticate, developerOnly, async (c) => {
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

export default classesRoutesDeveloper
