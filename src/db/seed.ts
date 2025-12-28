import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
// تأكد من إضافة exams و questions هنا بعد تعريفهم في السكيما
import { user, school, classRoom, subject, schedule, studentGrades, exams, questions } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = 'sqlite.db';
const REMOTE_SQL_FILE = 'seed-remote.sql';
const IS_REMOTE = process.argv.includes('--remote');

const SCHOOLS_COUNT = 1; // قللت العدد للتجربة السريعة
const CLASSROOMS_PER_SCHOOL = 3;
const SUBJECT_NAMES = ['Math', 'Science', 'English', 'History', 'ICT'];
const STUDENTS_PER_CLASS = 5;

const sqlStatements: string[] = [];
const ids = { school: 1, user: 1, classRoom: 1, subject: 1, schedule: 1, studentGrades: 1, exams: 1, questions: 1 };

function escape(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(val)}'`; // للتعامل مع الخيارات في الأسئلة
}

function executeInsert(db: any, table: any, data: any, tableName: string) {
    if (IS_REMOTE) {
        const id = ids[tableName as keyof typeof ids]++;
        const dataWithId = { ...data, id };
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
    console.log(`🌱 Seeding EduDash...`);
    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);
    const hashedPassword = await bcrypt.hash('123456', 10);

    if (IS_REMOTE) {
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
        sqlStatements.push('DELETE FROM sqlite_sequence;'); // Reset auto-increment
        sqlStatements.push('PRAGMA foreign_keys = ON;');
    }

    // 1. إنشاء المدرسة
    const schoolRes = executeInsert(db, school, { name: "EduDash Academy" }, 'school');

    // 2. إنشاء الآدمن بإيميل بسيط
    const adminRes = executeInsert(db, user, {
        userName: 'Admin',
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'admin',
        schoolId: schoolRes.id
    }, 'user');

    // 3. إنشاء المعلمين (معلم واحد لكل 5 مواد)
    const teachers: any[] = [];
    for (let t = 1; t <= 2; t++) {
        const teacherRes = executeInsert(db, user, {
            userName: `Teacher ${t}`,
            email: `t${t}@test.com`,
            password: hashedPassword,
            role: 'teacher',
            schoolId: schoolRes.id
        }, 'user');
        teachers.push(teacherRes);
    }

    // 4. إنشاء الفصول والمواد والامتحانات
    for (let i = 1; i <= CLASSROOMS_PER_SCHOOL; i++) {
        const classRes = executeInsert(db, classRoom, {
            name: `Grade ${i}`,
            schoolId: schoolRes.id
        }, 'classRoom');

        for (let s = 0; s < SUBJECT_NAMES.length; s++) {
            // توزيع المعلمين: المعلم الأول يأخذ أول 5 مواد وهكذا
            const assignedTeacher = teachers[s % teachers.length];

            const subjectRes = executeInsert(db, subject, {
                name: SUBJECT_NAMES[s],
                classId: classRes.id,
                teacherId: assignedTeacher.id
            }, 'subject');

            // 5. إضافة اختبار تجريبي لكل مادة
            const examRes = executeInsert(db, exams, {
                title: `Final ${SUBJECT_NAMES[s]} Quiz`,
                description: "Simple test to verify the system",
                subjectId: subjectRes.id,
                classId: classRes.id,
                teacherId: assignedTeacher.id,
                durationInMinutes: 30
            }, 'exams');

            // 6. إضافة أسئلة بسيطة للاختبار
            executeInsert(db, questions, {
                examId: examRes.id,
                questionText: `What is 1 + ${s}?`,
                options: JSON.stringify([`${1 + s}`, `${2 + s}`, `${3 + s}`, `${4 + s}`]),
                correctAnswerIndex: 0, // الخيار الأول
                points: 10
            }, 'questions');
        }

        // 7. إضافة طلاب بإيميلات بسيطة
        for (let st = 1; st <= STUDENTS_PER_CLASS; st++) {
            executeInsert(db, user, {
                userName: `Student ${i}-${st}`,
                email: `s${i}${st}@test.com`,
                password: hashedPassword,
                role: 'student',
                schoolId: schoolRes.id,
                classId: classRes.id
            }, 'user');
        }
    }

    if (IS_REMOTE) {
        fs.writeFileSync(path.resolve(process.cwd(), REMOTE_SQL_FILE), sqlStatements.join('\n'));
        console.log(`✅ Remote SQL file generated!`);
    } else {
        console.log('✅ Local seeding done!');
    }
}

seed().catch(console.error);