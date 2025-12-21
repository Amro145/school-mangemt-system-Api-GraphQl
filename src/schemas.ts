import { z } from 'zod';
import { userRoles } from './db/schema';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  userName: z.string().min(2),
});

export const createSchoolSchema = z.object({
  name: z.string().min(3),
});

export const createClassRoomSchema = z.object({
  name: z.string().min(1),
});

export const createUserSchema = z.object({
  userName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(userRoles),
  password: z.string().min(6),
  classId: z.number().optional(),
});

export const createSubjectSchema = z.object({
  name: z.string().min(1),
  classId: z.number(),
  teacherId: z.number(),
});

export const addGradeSchema = z.object({
  studentId: z.number(),
  subjectId: z.number(),
  score: z.number().min(0).max(100),
});
