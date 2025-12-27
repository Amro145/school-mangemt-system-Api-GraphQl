import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { user, school, classRoom, subject, schedule, studentGrades } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

// Configuration
const DB_PATH = 'sqlite.db'; // Assuming standard local sqlite.db
const SCHOOLS_COUNT = 2;
const CLASSROOMS_PER_SCHOOL = 10;
const SUBJECTS_COUNT = 6;
const STUDENTS_PER_CLASS = 20;

// Fixed Days & Time Slots
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const PERIODS = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '12:00', end: '13:00' },
    { start: '13:00', end: '14:00' },
];

const SUBJECT_NAMES = ['Mathematics', 'Physics', 'History', 'Biology', 'English', 'Computer Science'];

async function seed() {
    console.log('🌱 Starting database seed...');

    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);

    // Hash password once
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Clean up existing data (Order matters for FK)
    console.log('🧹 Cleaning existing data...');
    db.delete(studentGrades).run();
    db.delete(schedule).run();
    db.delete(subject).run();
    db.delete(user).run();
    db.delete(classRoom).run();
    db.delete(school).run();

    console.log('🏫 creating Schools & Admins...');

    for (let i = 0; i < SCHOOLS_COUNT; i++) {
        const schoolName = `School ${String.fromCharCode(65 + i)}`;

        // 1. Create School (initially without admin)
        const schoolRes = db.insert(school).values({
            name: schoolName,
        }).returning({ id: school.id }).get();

        if (!schoolRes) continue;

        // 2. Create Admin
        const adminRes = db.insert(user).values({
            userName: `admin_${schoolName.replace(' ', '')}`,
            email: `admin${i}@${schoolName.replace(' ', '').toLowerCase()}.com`,
            password: hashedPassword,
            role: 'admin',
            schoolId: schoolRes.id,
            createdAt: new Date().toISOString()
        }).returning({ id: user.id }).get();

        if (!adminRes) continue;

        // 3. Link Admin to School
        db.update(school)
            .set({ adminId: adminRes.id })
            .where(eq(school.id, schoolRes.id))
            .run();

        console.log(`   > Created ${schoolName} with Admin (ID: ${adminRes.id})`);

        // 4. Create Classrooms
        for (let j = 0; j < CLASSROOMS_PER_SCHOOL; j++) {
            const className = `Class ${j + 1}-${String.fromCharCode(65 + i)}`;

            const classRes = db.insert(classRoom).values({
                name: className,
                schoolId: schoolRes.id
            }).returning({ id: classRoom.id }).get();

            if (!classRes) continue;

            // 5. Create Teachers & Subjects
            const subjectIds: number[] = [];

            for (let k = 0; k < SUBJECTS_COUNT; k++) {
                // Create Teacher
                const teacherRes = db.insert(user).values({
                    userName: `Teacher_${className}_${SUBJECT_NAMES[k]}`,
                    email: `teacher_${className.replace(' ', '')}_${k}@school.com`.toLowerCase(),
                    password: hashedPassword,
                    role: 'teacher',
                    schoolId: schoolRes.id,
                    createdAt: new Date().toISOString()
                }).returning({ id: user.id }).get();

                if (!teacherRes) continue;

                // Create Subject
                const subjectName = SUBJECT_NAMES[k];
                const subjectRes = db.insert(subject).values({
                    name: subjectName,
                    classId: classRes.id,
                    teacherId: teacherRes.id
                }).returning({ id: subject.id }).get();

                if (subjectRes) subjectIds.push(subjectRes.id);
            }

            // 6. Create Students & Grades
            for (let l = 0; l < STUDENTS_PER_CLASS; l++) {
                const studentRes = db.insert(user).values({
                    userName: `Student_${className}_${l + 1}`,
                    email: `student_${className.replace(' ', '')}_${l}@school.com`.toLowerCase(),
                    password: hashedPassword,
                    role: 'student',
                    schoolId: schoolRes.id,
                    classId: classRes.id, // Link to class
                    createdAt: new Date().toISOString()
                }).returning({ id: user.id }).get();

                if (!studentRes) continue;

                // Insert Random Grades for all subjects
                for (const subjId of subjectIds) {
                    const randomScore = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
                    db.insert(studentGrades).values({
                        studentId: studentRes.id,
                        subjectId: subjId,
                        classId: classRes.id,
                        score: randomScore
                    }).run();
                }
            }

            // 7. Generate Timetables (Schedules)
            // Strategy: Rotate subjects across the week
            let subjectIndex = 0;
            for (const day of DAYS) {
                for (const period of PERIODS) {
                    const subjId = subjectIds[subjectIndex % subjectIds.length];

                    db.insert(schedule).values({
                        classId: classRes.id,
                        subjectId: subjId,
                        day: day,
                        startTime: period.start,
                        endTime: period.end
                    }).run();

                    subjectIndex++;
                }
            }
        }
    }

    console.log('✅ Seeding completed!');
    console.log(`   - ${SCHOOLS_COUNT} Schools`);
    console.log(`   - ${SCHOOLS_COUNT * CLASSROOMS_PER_SCHOOL} Classrooms`);
    console.log(`   - ${SCHOOLS_COUNT * CLASSROOMS_PER_SCHOOL * SUBJECTS_COUNT} Subjects & Teachers`);
    console.log(`   - ${SCHOOLS_COUNT * CLASSROOMS_PER_SCHOOL * STUDENTS_PER_CLASS} Students`);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
