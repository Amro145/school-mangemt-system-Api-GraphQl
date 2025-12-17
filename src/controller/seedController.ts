
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Env, Variables } from '../index'; // Adjust import path if needed
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

const seedController = new Hono<{ Bindings: Env; Variables: Variables }>();

seedController.post('/', async (c) => {
    const db = drizzle(c.env.myAppD1, { schema });

    try {
        // 1. Create Users
        const hashedPassword = await bcrypt.hash("123456", 10);

        // Admin
        const adminData = { userName: "Admin User", email: `admin_${Date.now()}@test.com`, password: hashedPassword, role: "admin" as const };
        const [admin] = await db.insert(schema.user).values(adminData).returning();

        // Teachers (5)
        const teachers = [];
        for (let i = 1; i <= 5; i++) {
            const teacherData = { userName: `Teacher ${i}`, email: `teacher_${i}_${Date.now()}@test.com`, password: hashedPassword, role: "teacher" as const };
            const [teacher] = await db.insert(schema.user).values(teacherData).returning();
            teachers.push(teacher);
        }

        // Students (20)
        const students = [];
        for (let i = 1; i <= 20; i++) {
            const studentData = { userName: `Student ${i}`, email: `student_${i}_${Date.now()}@test.com`, password: hashedPassword, role: "student" as const };
            const [student] = await db.insert(schema.user).values(studentData).returning();
            students.push(student);
        }

        // 2. Create Schools (3) - Managed by the Admin we just created
        const schools = [];
        for (let i = 1; i <= 3; i++) {
            const schoolData = { name: `School ${String.fromCharCode(64 + i)}`, adminId: admin.id };
            const [school] = await db.insert(schema.school).values(schoolData).returning();
            schools.push(school);
        }

        // 3. Create Subjects (5)
        const subjects = [];
        const subjectNames = ["Math", "Science", "History", "English", "Art"];
        for (const name of subjectNames) {
            const [subject] = await db.insert(schema.subject).values({ name: `${name} ${Date.now()}` }).returning();
            subjects.push(subject);
        }

        // 4. Create Classes for each School (e.g., 2 classes per school)
        const classes = [];
        for (const school of schools) {
            for (let i = 1; i <= 2; i++) {
                const classData = { name: `Class ${i} - ${school.name}`, schoolId: school.id };
                const [classRoom] = await db.insert(schema.classRoom).values(classData).returning();
                classes.push(classRoom);
            }
        }

        // 5. Assign Teachers and Subjects to Classes (Connections)
        // For each class, assign 2 subjects with random teachers
        for (const classRoom of classes) {
            for (let i = 0; i < 2; i++) {
                const subject = subjects[i]; // Simple assignment
                const teacher = teachers[i % teachers.length];
                await db.insert(schema.classSubjects).values({
                    classRoomId: classRoom.id,
                    subjectId: subject.id,
                    teacherId: teacher.id
                });
            }
        }

        // 6. Enroll Students in Classes
        // Distribute students among classes. E.g., each student in 1 class
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const classRoom = classes[i % classes.length];
            await db.insert(schema.enrollments).values({
                studentId: student.id,
                classRoomId: classRoom.id
            });

            // 7. Add Grades for these enrollments
            // Add a grade for one of the subjects in the class
            // We know the first 2 subjects are in every class effectively based on above logic, or at least assigned
            const subject = subjects[0];
            await db.insert(schema.studentGrades).values({
                studentId: student.id,
                classRoomId: classRoom.id,
                subjectId: subject.id,
                score: Math.floor(Math.random() * 100),
                type: 'final'
            });
        }

        return c.json({
            message: "Database seeded successfully",
            counts: {
                users: 1 + teachers.length + students.length,
                schools: schools.length,
                classes: classes.length,
                subjects: subjects.length
            }
        });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default seedController;
