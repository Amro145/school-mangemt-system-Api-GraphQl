import { z } from 'zod';

const userRoles = ['admin', 'teacher', 'student'] as const;
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
  userName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(userRoles),
  password: z.string().min(6),
  classId: z.number().optional(),
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
export const createScheduleSchema = z.object({
  classId: z.number(),
  subjectId: z.number(),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string(),
  endTime: z.string(),
});