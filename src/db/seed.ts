import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { user, school, classRoom, subject, schedule, studentGrades } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DB_PATH = 'sqlite.db';
const REMOTE_SQL_FILE = 'seed-remote.sql';
const IS_REMOTE = process.argv.includes('--remote');

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

// SQL Statement Store for Remote Mode
const sqlStatements: string[] = [];
// ID Counters for Remote Mode (Since we mimic auto-increment)
const ids = {
    school: 1,
    user: 1,
    classRoom: 1,
    subject: 1,
    schedule: 1,
    studentGrades: 1
};

// Helper to escape strings for SQL
function escape(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; // Basic SQL escaping
    return `'${val}'`;
}

// Wrapper to handle execution
function executeInsert(db: any, table: any, data: any, tableName: string) {
    if (IS_REMOTE) {
        // Assign ID explicitly
        const id = ids[tableName as keyof typeof ids]++;
        const dataWithId = { ...data, id };

        // Generate INSERT Statement
        const keys = Object.keys(dataWithId);
        const values = Object.values(dataWithId).map(escape);
        const statement = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
        sqlStatements.push(statement);

        return { id };
    } else {
        return db.insert(table).values(data).returning({ id: table.id }).get();
    }
}

async function seed() {
    console.log(`🌱 Starting database seed (${IS_REMOTE ? 'Remote Mode' : 'Local Mode'})...`);

    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Clean up
    console.log('🧹 Cleaning existing data...');
    if (IS_REMOTE) {
        // Disable FK checks temporarily for cleanup or handle circular dependency
        sqlStatements.push('UPDATE school SET adminId = NULL;'); // Break circular dependency
        sqlStatements.push('DELETE FROM studentGrades;');
        sqlStatements.push('DELETE FROM schedule;');
        sqlStatements.push('DELETE FROM subject;');
        sqlStatements.push('DELETE FROM user;');
        sqlStatements.push('DELETE FROM classRoom;');
        sqlStatements.push('DELETE FROM school;');
        // Reset Sequences in SQLite
        sqlStatements.push("DELETE FROM sqlite_sequence WHERE name IN ('studentGrades', 'schedule', 'subject', 'user', 'classRoom', 'school');");
    } else {
        // Local: Order assumes FKs are not strictly enforced or handled by driver
        // For safety locally:
        db.update(school).set({ adminId: null }).run();

        db.delete(studentGrades).run();
        db.delete(schedule).run();
        db.delete(subject).run();
        db.delete(user).run();
        db.delete(classRoom).run();
        db.delete(school).run();
    }

    console.log('🏫 creating Schools & Admins...');

    for (let i = 0; i < SCHOOLS_COUNT; i++) {
        const schoolName = `School ${String.fromCharCode(65 + i)}`;

        // 1. Create School
        const schoolRes = executeInsert(db, school, { name: schoolName }, 'school');
        if (!schoolRes) continue;

        // 2. Create Admin
        const adminRes = executeInsert(db, user, {
            userName: `admin_${schoolName.replace(' ', '')}`,
            email: `admin${i}@${schoolName.replace(' ', '').toLowerCase()}.com`,
            password: hashedPassword,
            role: 'admin',
            schoolId: schoolRes.id,
            createdAt: new Date().toISOString()
        }, 'user');
        if (!adminRes) continue;

        // 3. Link Admin to School
        if (IS_REMOTE) {
            sqlStatements.push(`UPDATE school SET adminId = ${adminRes.id} WHERE id = ${schoolRes.id};`);
        } else {
            db.update(school)
                .set({ adminId: adminRes.id })
                .where(eq(school.id, schoolRes.id))
                .run();
        }

        console.log(`   > Created ${schoolName} with Admin (ID: ${adminRes.id})`);

        // 4. Create Classrooms
        for (let j = 0; j < CLASSROOMS_PER_SCHOOL; j++) {
            const className = `Class ${j + 1}-${String.fromCharCode(65 + i)}`;

            const classRes = executeInsert(db, classRoom, {
                name: className,
                schoolId: schoolRes.id
            }, 'classRoom');
            if (!classRes) continue;

            // 5. Create Teachers & Subjects
            const subjectIds: number[] = [];

            for (let k = 0; k < SUBJECTS_COUNT; k++) {
                // Create Teacher
                const teacherRes = executeInsert(db, user, {
                    userName: `Teacher_${className}_${SUBJECT_NAMES[k]}`,
                    email: `teacher_${className.replace(' ', '')}_${k}@school.com`.toLowerCase(),
                    password: hashedPassword,
                    role: 'teacher',
                    schoolId: schoolRes.id,
                    createdAt: new Date().toISOString()
                }, 'user');
                if (!teacherRes) continue;

                // Create Subject
                const subjectName = SUBJECT_NAMES[k];
                const subjectRes = executeInsert(db, subject, {
                    name: subjectName,
                    classId: classRes.id,
                    teacherId: teacherRes.id
                }, 'subject');

                if (subjectRes) subjectIds.push(subjectRes.id);
            }

            // 6. Create Students & Grades
            for (let l = 0; l < STUDENTS_PER_CLASS; l++) {
                const studentRes = executeInsert(db, user, {
                    userName: `Student_${className}_${l + 1}`,
                    email: `student_${className.replace(' ', '')}_${l}@school.com`.toLowerCase(),
                    password: hashedPassword,
                    role: 'student',
                    schoolId: schoolRes.id,
                    classId: classRes.id,
                    createdAt: new Date().toISOString()
                }, 'user');
                if (!studentRes) continue;

                // Insert Random Grades
                for (const subjId of subjectIds) {
                    const randomScore = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
                    executeInsert(db, studentGrades, {
                        studentId: studentRes.id,
                        subjectId: subjId,
                        classId: classRes.id,
                        score: randomScore
                    }, 'studentGrades');
                }
            }

            // 7. Generate Timetables
            let subjectIndex = 0;
            for (const day of DAYS) {
                for (const period of PERIODS) {
                    const subjId = subjectIds[subjectIndex % subjectIds.length];
                    executeInsert(db, schedule, {
                        classId: classRes.id,
                        subjectId: subjId,
                        day: day,
                        startTime: period.start,
                        endTime: period.end
                    }, 'schedule');
                    subjectIndex++;
                }
            }
        }
    }

    if (IS_REMOTE) {
        console.log('💾 Writing SQL to file...');
        fs.writeFileSync(Remote_SQL_FILE_PATH, sqlStatements.join('\n'));
        console.log(`✅ SQL generated at ${Remote_SQL_FILE_PATH}`);
    } else {
        console.log('✅ Seeding completed!');
    }
}

const Remote_SQL_FILE_PATH = path.resolve(process.cwd(), REMOTE_SQL_FILE);

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
