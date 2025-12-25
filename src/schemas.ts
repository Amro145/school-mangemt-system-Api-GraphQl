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
  schoolId: z.number().optional(),
});

export const createUserSchema = z.object({
  userName: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  role: z.enum(userRoles),
  password: z.string().min(6, "Password must be at least 6 characters"),
  classId: z.number().optional().nullable(),
}).refine((data) => {
  if (data.role === 'student' && !data.classId) {
    return false;
  }
  return true;
}, {
  message: "Class ID is required and must be valid for students",
  path: ["classId"],
});

export const createAdminSchema = z.object({
  userName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
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
