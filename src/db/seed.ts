
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { user, school, classRoom, subject, schedule, studentGrades, exams, questions } from './schema';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = 'sqlite.db';
const REMOTE_SQL_FILE = 'seed-remote.sql';
// Always remote for this task as we want to generate SQL
const IS_REMOTE = true;

const SCHOOLS_COUNT = 1;
const CLASSES_COUNT = 10;
const STUDENTS_PER_CLASS = 20;
const TEACHERS_COUNT = 10;
const SUBJECTS_PER_CLASS = 6;
const SUBJECT_NAMES_POOL = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History',
    'Geography', 'Computer Science', 'Art', 'Music', 'Physical Education', 'Literature'
];

const sqlStatements: string[] = [];
// Start IDs from 1
const ids = {
    school: 1,
    user: 1,
    classRoom: 1,
    subject: 1,
    schedule: 1,
    studentGrades: 1,
    exams: 1,
    questions: 1
};

function escape(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(val)}'`;
}

function executeInsert(table: any, data: any, tableName: string) {
    const id = ids[tableName as keyof typeof ids]++;
    const dataWithId = { ...data, id };

    // SQLite boolean handling or other specific conversions if needed
    // But mostly string/number is fine. 
    // Timestamps are strings in current schema.

    const keys = Object.keys(dataWithId);
    const values = Object.values(dataWithId).map(escape);
    const statement = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
    sqlStatements.push(statement);
    return { id, ...dataWithId };
}

async function seed() {
    console.log(`🌱 Generating Complex Seed Data for EduDash...`);

    const password = 'amroamro';
    const hashedPassword = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    // Cleanup existing data
    sqlStatements.push('PRAGMA foreign_keys = OFF;');
    sqlStatements.push('DELETE FROM examSubmissions;');
    sqlStatements.push('DELETE FROM questions;');
    sqlStatements.push('DELETE FROM exams;');
    sqlStatements.push('DELETE FROM studentGrades;');
    sqlStatements.push('DELETE FROM schedule;');
    sqlStatements.push('DELETE FROM subject;');
    sqlStatements.push('DELETE FROM user;');
    sqlStatements.push('DELETE FROM classRoom;');
    sqlStatements.push('DELETE FROM school;');
    sqlStatements.push('DELETE FROM sqlite_sequence;');
    sqlStatements.push('PRAGMA foreign_keys = ON;');

    // 1. Create School
    const schoolRes = executeInsert(school, { name: "EduDash International School" }, 'school');

    // 2. Create Admin
    executeInsert(user, {
        userName: 'School Manager',
        email: 'admin@edudash.com',
        password: hashedPassword,
        role: 'admin',
        schoolId: schoolRes.id,
        createdAt
    }, 'user');

    // 3. Create Teachers
    const teachers: any[] = [];
    for (let t = 1; t <= TEACHERS_COUNT; t++) {
        const teacher = executeInsert(user, {
            userName: `Teacher ${t}`,
            email: `teacher${t}@edudash.com`,
            password: hashedPassword,
            role: 'teacher',
            schoolId: schoolRes.id,
            createdAt
        }, 'user');
        teachers.push(teacher);
    }

    // 4. Create Classes, Subjects, assigned Teachers
    const classes: any[] = [];
    for (let c = 1; c <= CLASSES_COUNT; c++) {
        const classObj = executeInsert(classRoom, {
            name: `Grade ${c}`,
            schoolId: schoolRes.id
        }, 'classRoom');
        classes.push(classObj);

        // Assign Subjects & Teachers
        // Logic: 6 subjects per class.
        // Teachers rotated: (classIndex + subjectIndex) % 10
        const classSubjects: any[] = [];

        for (let s = 0; s < SUBJECTS_PER_CLASS; s++) {
            // Pick subject name from pool or generic. 
            // Let's use generic names + generic to ensure unique names per class if needed, 
            // but standard names are better.
            const subjectName = SUBJECT_NAMES_POOL[s % SUBJECT_NAMES_POOL.length]; // cycling names 

            // Teacher Assignment Logic
            const teacherIndex = ((c - 1) + s) % TEACHERS_COUNT;
            const assignedTeacher = teachers[teacherIndex];

            const subjectObj = executeInsert(subject, {
                name: subjectName,
                classId: classObj.id,
                teacherId: assignedTeacher.id
            }, 'subject');
            classSubjects.push(subjectObj);

            // Create Exam for this subject
            const examObj = executeInsert(exams, {
                title: `${subjectName} Midterm`,
                description: `Midterm examination for ${subjectName}`,
                durationInMinutes: 60,
                subjectId: subjectObj.id,
                classId: classObj.id,
                teacherId: assignedTeacher.id,
                createdAt,
                type: 'Midterm'
            }, 'exams');

            // Add Questions
            for (let q = 1; q <= 5; q++) {
                executeInsert(questions, {
                    examId: examObj.id,
                    questionText: `Sample Question ${q} for ${subjectName}?`,
                    options: JSON.stringify(["Option A", "Option B", "Option C", "Option D"]),
                    correctAnswerIndex: 0,
                    points: 20
                }, 'questions');
            }
        }

        classObj.subjects = classSubjects;
    }

    // 5. Create Students & Grades
    for (const cls of classes) {
        for (let st = 1; st <= STUDENTS_PER_CLASS; st++) {
            const student = executeInsert(user, {
                userName: `Student ${cls.name}-${st}`,
                email: `student_${cls.id}_${st}@edudash.com`,
                password: hashedPassword,
                role: 'student',
                schoolId: schoolRes.id,
                classId: cls.id,
                createdAt
            }, 'user');

            // Assign Scores for all subjects in class
            for (const sub of cls.subjects) {
                executeInsert(studentGrades, {
                    studentId: student.id,
                    subjectId: sub.id,
                    classId: cls.id,
                    score: Math.floor(Math.random() * 51) + 50, // 50-100
                    type: 'Midterm'
                }, 'studentGrades');
            }
        }
    }

    // 6. Create Timetable (Weekly Schedule)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const periods = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

    for (const cls of classes) {
        let subjectIndex = 0;
        for (const day of days) {
            for (let p = 0; p < periods.length; p++) {
                const startTime = periods[p];
                const endTime = periods[p].replace(':00', ':45'); // 45 min class

                const sub = cls.subjects[subjectIndex % cls.subjects.length];
                subjectIndex++;

                executeInsert(schedule, {
                    classId: cls.id,
                    subjectId: sub.id,
                    day: day,
                    startTime: startTime,
                    endTime: endTime
                }, 'schedule');
            }
        }
    }

    // Write to file
    fs.writeFileSync(path.resolve(process.cwd(), REMOTE_SQL_FILE), sqlStatements.join('\n'));
    console.log(`✅ SQL Seed file generated at ${REMOTE_SQL_FILE}`);
    console.log(`Stats:`);
    console.log(`- School: 1`);
    console.log(`- Admin: 1`);
    console.log(`- Teachers: ${TEACHERS_COUNT}`);
    console.log(`- Classes: ${CLASSES_COUNT}`);
    console.log(`- Students: ${CLASSES_COUNT * STUDENTS_PER_CLASS}`);
    console.log(`- Subjects: ${CLASSES_COUNT * SUBJECTS_PER_CLASS}`);
}

seed().catch(console.error);
