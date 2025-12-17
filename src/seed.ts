import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export const seed = async (db: DrizzleD1Database<typeof schema>) => {
    console.log('Seeding database...');

    // 1. CLEANUP
    console.log('Cleaning up...');
    await db.delete(schema.studentGrades);
    await db.delete(schema.enrollments);
    await db.delete(schema.classSubjects);
    await db.delete(schema.classRoom);
    await db.delete(schema.subject);
    await db.delete(schema.school);
    await db.delete(schema.user);

    // 2. PASSWORD
    const hashedPassword = await bcrypt.hash('123456', 10);

    // 3. ADMINS & SCHOOLS
    const admins = [];
    const schools = [];

    // Create 2 Admins
    for (let i = 0; i < 2; i++) {
        const [admin] = await db.insert(schema.user).values({
            userName: faker.person.fullName(),
            email: faker.internet.email(),
            password: hashedPassword,
            role: 'admin',
        }).returning();
        admins.push(admin);

        const [school] = await db.insert(schema.school).values({
            name: faker.company.name() + ' School',
            adminId: admin.id,
        }).returning();
        schools.push(school);
    }

    // 4. CLASSES
    const classRooms = [];
    for (const school of schools) {
        for (let i = 0; i < 6; i++) {
            const [classRoom] = await db.insert(schema.classRoom).values({
                name: `Class ${faker.word.adjective()} ${i + 1}`,
                schoolId: school.id,
            }).returning();
            classRooms.push(classRoom);
        }
    }

    // 5. SUBJECTS & TEACHERS & CONNECTIONS
    console.log('Creating subjects, teachers, and connections...');
    // Pool of teachers per school
    for (const school of schools) {
        const teachers = [];
        // Create 8 teachers for this school
        for (let i = 0; i < 8; i++) {
            const [teacher] = await db.insert(schema.user).values({
                userName: faker.person.fullName(),
                email: faker.internet.email(),
                password: hashedPassword,
                role: 'teacher',
            }).returning();
            teachers.push(teacher);
        }

        const schoolClasses = classRooms.filter(c => c.schoolId === school.id);

        for (const cls of schoolClasses) {
            // Create 6-8 Subjects for this class
            const numSubjects = faker.number.int({ min: 6, max: 8 });
            for (let j = 0; j < numSubjects; j++) {
                const [subject] = await db.insert(schema.subject).values({
                    name: faker.word.noun(),
                }).returning();

                const randomTeacher = faker.helpers.arrayElement(teachers);

                await db.insert(schema.classSubjects).values({
                    classRoomId: cls.id,
                    subjectId: subject.id,
                    teacherId: randomTeacher.id
                });
            }
        }
    }

    // 6. STUDENTS & ENROLLMENTS & GRADES
    console.log('Creating students, enrollments, and grades...');
    for (const cls of classRooms) {
        // Get class subjects to assign grades
        const classSubjectsList = await db.select().from(schema.classSubjects).where(eq(schema.classSubjects.classRoomId, cls.id));

        const numStudents = faker.number.int({ min: 10, max: 20 });
        for (let s = 0; s < numStudents; s++) {
            const [student] = await db.insert(schema.user).values({
                userName: faker.person.fullName(),
                email: faker.internet.email(),
                password: hashedPassword,
                role: 'student',
            }).returning();

            await db.insert(schema.enrollments).values({
                studentId: student.id,
                classRoomId: cls.id,
            });

            // 7. GRADES
            const gradeInputs = classSubjectsList.map(sub => ({
                studentId: student.id,
                classRoomId: cls.id,
                subjectId: sub.subjectId,
                score: faker.number.int({ min: 50, max: 100 }),
                type: 'final' as const,
            }));

            if (gradeInputs.length > 0) {
                await db.insert(schema.studentGrades).values(gradeInputs);
            }
        }
    }

    console.log('Seeding complete!');
    return { message: "Seeding successful" };
};
