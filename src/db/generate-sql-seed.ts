import fs from 'fs';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const OUTPUT_FILE = 'seed-remote.sql';

const generate = async () => {
    console.log('🔨 Generatng SQL seed data...');

    const adminPassword = await bcrypt.hash("amro123#$", 10);
    const defaultPassword = await bcrypt.hash("password123", 10);

    let sql = `-- Auto-generated seed file for Remote D1
PRAGMA foreign_keys = OFF;
DELETE FROM studentGrades;
DELETE FROM subject;
DELETE FROM user;
DELETE FROM classRoom;
DELETE FROM school;
DELETE FROM sqlite_sequence;
PRAGMA foreign_keys = ON;

-- 1. Create Admin
INSERT INTO user (id, userName, email, password, role, createdAt) VALUES (1, 'Super Amro', 'admin@school.com', '${adminPassword}', 'admin', CURRENT_TIMESTAMP);

-- 2. Create School
INSERT INTO school (id, name, adminId, createdAt) VALUES (1, 'Amro International School', 1, CURRENT_TIMESTAMP);

-- 3. Update Admin with School
UPDATE user SET schoolId = 1 WHERE id = 1;

`;

    let userIdCounter = 2;
    const teacherIds: number[] = [];
    const classIds: number[] = [];
    const subjectIds: number[] = [];

    // --- Teachers (10) ---
    console.log('.. Generating 10 Teachers');
    for (let i = 0; i < 10; i++) {
        const id = userIdCounter++;
        teacherIds.push(id);
        const name = faker.person.fullName().replace(/'/g, "''"); // Escape single quotes
        sql += `INSERT INTO user (id, userName, email, password, role, schoolId, createdAt) VALUES (${id}, '${name}', '${faker.internet.email()}', '${defaultPassword}', 'teacher', 1, CURRENT_TIMESTAMP);\n`;
    }

    // --- ClassRooms (10) ---
    console.log('.. Generating 10 ClassRooms');
    for (let i = 1; i <= 10; i++) {
        classIds.push(i);
        const name = `Grade ${i}`;
        sql += `INSERT INTO classRoom (id, name, schoolId, createdAt) VALUES (${i}, '${name}', 1, CURRENT_TIMESTAMP);\n`;
    }

    // --- Subjects (3 per Class = 30) ---
    console.log('.. Generating Subjects');
    let subjectIdCounter = 1;
    const subjects: { id: number, classId: number }[] = [];

    for (const cid of classIds) {
        for (let j = 0; j < 3; j++) {
            const sid = subjectIdCounter++;
            const teacherId = faker.helpers.arrayElement(teacherIds);
            const subjName = faker.helpers.arrayElement(['Math', 'Science', 'History', 'English', 'Art', 'Physics']) + ' ' + cid;
            sql += `INSERT INTO subject (id, name, classId, teacherId, createdAt) VALUES (${sid}, '${subjName}', ${cid}, ${teacherId}, CURRENT_TIMESTAMP);\n`;
            subjects.push({ id: sid, classId: cid });
        }
    }

    // --- Students (30 per Class = 300) ---
    console.log('.. Generating 300 Students');
    for (const cid of classIds) {
        for (let k = 0; k < 30; k++) {
            const id = userIdCounter++;
            const name = faker.person.fullName().replace(/'/g, "''");
            const email = faker.internet.email();
            sql += `INSERT INTO user (id, userName, email, password, role, schoolId, classId, createdAt) VALUES (${id}, '${name}', '${email}', '${defaultPassword}', 'student', 1, ${cid}, CURRENT_TIMESTAMP);\n`;

            // --- Grades for Student ---
            // Give grades for all subjects in their class
            const classSubjects = subjects.filter(s => s.classId === cid);
            for (const subj of classSubjects) {
                const score = faker.number.int({ min: 60, max: 100 });
                sql += `INSERT INTO studentGrades (studentId, subjectId, classId, score, dateRecorded) VALUES (${id}, ${subj.id}, ${cid}, ${score}, CURRENT_TIMESTAMP);\n`;
            }
        }
    }

    fs.writeFileSync(OUTPUT_FILE, sql);
    console.log(`✅ Generated ${OUTPUT_FILE} with ${userIdCounter} users.`);
};

generate().catch(console.error);
