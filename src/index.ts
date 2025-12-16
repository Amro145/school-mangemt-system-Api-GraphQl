import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono'
import * as schema from './db/schema';
import bcrypt from 'bcryptjs';
import userRoutes from './controller/userController';
import schoolRoutes from './controller/schoolController';
import classesRoutes from './controller/classesController';
import subjectRoutes from './controller/subjectController';
import connectionRoutes from './controller/connectionController';
import enrollmentsRoutes from './controller/enrollmentsController';
import gradeRoutes from './controller/gradgeController';

export type Env = {
  MY_VAR: string;
  PRIVATE: string;
  myAppD1: D1Database;
  JWT_SECRET: string;
}

export type Variables = {
  user: { id: number; email: string; role: string };
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.route('/users', userRoutes);
app.route('/schools', schoolRoutes);
app.route('/classes', classesRoutes);
app.route('/subjects', subjectRoutes);
app.route('/connections', connectionRoutes);
app.route('/enrollments', enrollmentsRoutes);
app.route('/grades', gradeRoutes);




export default app