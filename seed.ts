import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './src/db/schema';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.dev.vars' });
dotenv.config();

async function main() {
    const isRemote = process.argv.includes('--remote');
    console.log(`🌱 Starting institutional seed process for School A & School B... ${isRemote ? '(REMOTE MODE)' : '(LOCAL MODE)'}`);

    let dbUrl = process.env.DB_URL;

    if (!dbUrl && !isRemote) {
        // Attempt to find local Wrangler D1 file for development convenience
        const wranglerStateDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

        if (fs.existsSync(wranglerStateDir)) {
            const files = fs.readdirSync(wranglerStateDir).filter(f => f.endsWith('.sqlite'));
            if (files.length > 0) {
                const dbPath = path.join(wranglerStateDir, files[0]);
                console.log(`📍 Found local Wrangler D1 database: ${dbPath}`);
                dbUrl = `file:${dbPath}`;
            }
        }
    }

    if (!dbUrl && !isRemote) {
        console.error('❌ Error: DB_URL not found in environment and no local database found.');
        process.exit(1);
    }

    // If remote, we will generate a SQL file instead of executing directly 
    // because direct connection to remote D1 from local node is complex without extra setup.
    if (isRemote) {
        console.log('📝 Remote mode detected. Generating seed-remote.sql for manual deployment...');
        await generateSqlSeed();
        return;
    }

    const client = createClient({ url: dbUrl as string });
    const db = drizzle(client, { schema });

    console.log('🧹 Purging existing administrative and academic records...');
    // Disable foreign keys for a clean wipe
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    await db.delete(schema.studentGrades);
    await db.delete(schema.subject);
    await db.delete(schema.classRoom);
    await db.delete(schema.school);
    await db.delete(schema.user);
    try {
        await db.run(sql`DELETE FROM sqlite_sequence`);
    } catch (e) {
        // sequence table might not exist if no autoincrement yet
    }
    await db.run(sql`PRAGMA foreign_keys = ON`);

    console.log('🔑 Hashing institutional password...');
    const institutionalPassword = await bcrypt.hash('amro123#$', 10);

    // 1. Create 2 Admin Users
    console.log('👤 Provisioning 2 Admin Accounts...');
    const [adminA] = await db.insert(schema.user).values({
        userName: 'Admin School A',
        email: 'admin.a@school.edu',
        password: institutionalPassword,
        role: 'admin',
    }).returning();

    const [adminB] = await db.insert(schema.user).values({
        userName: 'Admin School B',
        email: 'admin.b@school.edu',
        password: institutionalPassword,
        role: 'admin',
    }).returning();

    // 2. Create 2 Schools
    console.log('🏫 Establishing School A & School B...');
    const [schoolA] = await db.insert(schema.school).values({
        name: 'School A',
        adminId: adminA.id
    }).returning();

    const [schoolB] = await db.insert(schema.school).values({
        name: 'School B',
        adminId: adminB.id
    }).returning();

    // Link Admins to their respective schools
    await db.update(schema.user).set({ schoolId: schoolA.id }).where(eq(schema.user.id, adminA.id));
    await db.update(schema.user).set({ schoolId: schoolB.id }).where(eq(schema.user.id, adminB.id));

    const schools = [schoolA, schoolB];

    // 3. Create 15 Teachers distributed across schools
    console.log('👨‍🏫 Onboarding 15 Teachers...');
    const teachers = [];
    for (let i = 0; i < 15; i++) {
        const assignedSchool = schools[i % 2];
        const [t] = await db.insert(schema.user).values({
            userName: faker.person.fullName(),
            email: `teacher${i + 1}@school.edu`,
            password: institutionalPassword,
            role: 'teacher',
            schoolId: assignedSchool.id,
        }).returning();
        teachers.push(t);
    }

    // 4. Create 8 Classes per School (16 Total)
    console.log('🏢 Constructing 16 Classrooms...');
    const classrooms = [];
    for (const school of schools) {
        for (let i = 1; i <= 8; i++) {
            const [cl] = await db.insert(schema.classRoom).values({
                name: `Grade ${faker.number.int({ min: 1, max: 12 })}-${String.fromCharCode(64 + i)}`,
                schoolId: school.id
            }).returning();
            classrooms.push(cl);
        }
    }

    // 5. Create 6 Subjects per Class (96 Total)
    console.log('📚 Initializing Curriculums (96 Subjects)...');
    const subjects = [];
    const coreSubjects = ['Mathematics', 'Science', 'English Language', 'History', 'Computer Science', 'Physical Education'];

    for (const cls of classrooms) {
        const schoolTeachers = teachers.filter(t => t.schoolId === cls.schoolId);
        for (let i = 0; i < 6; i++) {
            const [sj] = await db.insert(schema.subject).values({
                name: coreSubjects[i],
                classId: cls.id,
                teacherId: faker.helpers.arrayElement(schoolTeachers).id
            }).returning();
            subjects.push(sj);
        }
    }

    // 6. Create 400 Students (Exactly 25 per Class)
    console.log('🎓 Enrolling 400 Students across 16 Cohorts...');
    const studentRecords = [];
    for (const cls of classrooms) {
        for (let i = 0; i < 25; i++) {
            studentRecords.push({
                userName: faker.person.fullName(),
                email: faker.internet.email({ provider: 'student.edu' }),
                password: institutionalPassword,
                role: 'student',
                schoolId: cls.schoolId,
                classId: cls.id
            });
        }
    }

    // Batch Insert Students in chunks of 50
    const insertedStudents = [];
    for (let i = 0; i < studentRecords.length; i += 50) {
        const chunk = studentRecords.slice(i, i + 50);
        const results = await db.insert(schema.user).values(chunk).returning();
        insertedStudents.push(...results);
    }

    // 7. Generate Grade Records (2400 Total)
    console.log('📊 Scoring Academic Performance (2400 Records)...');
    const gradesData = [];
    for (const student of insertedStudents) {
        const classSubjects = subjects.filter(s => s.classId === student.classId);
        for (const sub of classSubjects) {
            gradesData.push({
                studentId: student.id,
                subjectId: sub.id,
                classId: student.classId!,
                score: faker.number.int({ min: 40, max: 95 })
            });
        }
    }

    // Batch Insert Grades using db.batch() in chunks of 100
    const gradeChunks = [];
    for (let i = 0; i < gradesData.length; i += 100) {
        gradeChunks.push(gradesData.slice(i, i + 100));
    }

    for (const [idx, chunk] of gradeChunks.entries()) {
        const batchOperations = chunk.map(grade => db.insert(schema.studentGrades).values(grade));
        await db.batch(batchOperations as any);
        if (idx % 4 === 0) console.log(`...Synced ${idx * 100} academic entries`);
    }

    console.log(`\n🎉 ECOSYSTEM INITIALIZATION COMPLETE`);
    console.log(`--------------------------------------`);
    console.log(`Schools Access: School A, School B`);
    console.log(`Admin Credentials: Password -> amro123#$`);
    console.log(`Faculty: 15 Teachers Assigned`);
    console.log(`Classrooms: 16 Enrolled`);
    console.log(`Total Student Population: 400`);
    console.log(`Total Data Points (Grades): ${gradesData.length}`);
    console.log(`--------------------------------------`);

    process.exit(0);
}

/**
 * Generates a SQL file for remote D1 deployment
 * This matches the logic of the local seeder but outputs SQL statements
 */
async function generateSqlSeed() {
    const OUTPUT_FILE = 'seed-remote.sql';
    const institutionalPassword = await bcrypt.hash('amro123#$', 10);

    let sqlContent = `-- SQL Seed for Remote D1
PRAGMA foreign_keys = OFF;
DELETE FROM studentGrades;
DELETE FROM subject;
DELETE FROM classRoom;
DELETE FROM school;
DELETE FROM user;
DELETE FROM sqlite_sequence;
PRAGMA foreign_keys = ON;

`;

    // 1. Admins
    sqlContent += `-- Create Admins
INSERT INTO user (id, userName, email, password, role) VALUES (1, 'Admin School A', 'admin.a@school.edu', '${institutionalPassword}', 'admin');
INSERT INTO user (id, userName, email, password, role) VALUES (2, 'Admin School B', 'admin.b@school.edu', '${institutionalPassword}', 'admin');

-- Create Schools
INSERT INTO school (id, name, adminId) VALUES (1, 'School A', 1);
INSERT INTO school (id, name, adminId) VALUES (2, 'School B', 2);

-- Link Admins to Schools
UPDATE user SET schoolId = 1 WHERE id = 1;
UPDATE user SET schoolId = 2 WHERE id = 2;

`;

    let userIdCounter = 3;
    let classroomIdCounter = 1;
    let subjectIdCounter = 1;

    // 2. Teachers (15)
    for (let i = 0; i < 15; i++) {
        const schoolId = (i % 2) + 1;
        const name = faker.person.fullName().replace(/'/g, "''");
        sqlContent += `INSERT INTO user (id, userName, email, password, role, schoolId) VALUES (${userIdCounter++}, '${name}', 'teacher${i + 1}@school.edu', '${institutionalPassword}', 'teacher', ${schoolId});\n`;
    }
    const teacherIdsRange = [3, userIdCounter - 1];

    // 3. Classroms (16)
    sqlContent += `\n-- Create Classrooms\n`;
    const classrooms: { id: number, schoolId: number }[] = [];
    for (let sId = 1; sId <= 2; sId++) {
        for (let i = 1; i <= 8; i++) {
            const name = `Grade ${faker.number.int({ min: 1, max: 12 })}-${String.fromCharCode(64 + i)}`;
            sqlContent += `INSERT INTO classRoom (id, name, schoolId) VALUES (${classroomIdCounter}, '${name}', ${sId});\n`;
            classrooms.push({ id: classroomIdCounter++, schoolId: sId });
        }
    }

    // 4. Subjects (6 per class)
    sqlContent += `\n-- Create Subjects\n`;
    const coreSubjects = ['Mathematics', 'Science', 'English Language', 'History', 'Computer Science', 'Physical Education'];
    const subjects: { id: number, classId: number }[] = [];

    for (const cls of classrooms) {
        // Find teachers for this school
        // Simple heuristic: even userIds are school 2, odd are school 1 (after accounting for offset)
        for (let i = 0; i < 6; i++) {
            // Random teacher from same school
            // In our teacher insert above: i=0 (Sch1), i=1 (Sch2), i=2 (Sch1)...
            // Teacher IDs start at 3.
            // Sch 1 teachers: 3, 5, 7, 9, 11, 13, 15, 17
            // Sch 2 teachers: 4, 6, 8, 10, 12, 14, 16
            let teacherId;
            if (cls.schoolId === 1) {
                teacherId = 3 + (Math.floor(Math.random() * 8) * 2);
            } else {
                teacherId = 4 + (Math.floor(Math.random() * 7) * 2);
            }
            if (teacherId > 17) teacherId = 3; // safety

            sqlContent += `INSERT INTO subject (id, name, classId, teacherId) VALUES (${subjectIdCounter}, '${coreSubjects[i]}', ${cls.id}, ${teacherId});\n`;
            subjects.push({ id: subjectIdCounter++, classId: cls.id });
        }
    }

    // 5. Students (400 total, 25 per class)
    sqlContent += `\n-- Enrolling 400 Students\n`;
    const students: { id: number, classId: number }[] = [];
    for (const cls of classrooms) {
        for (let i = 0; i < 25; i++) {
            const sId = userIdCounter++;
            const name = faker.person.fullName().replace(/'/g, "''");
            const email = `student.${sId}@student.edu`;
            sqlContent += `INSERT INTO user (id, userName, email, password, role, schoolId, classId) VALUES (${sId}, '${name}', '${email}', '${institutionalPassword}', 'student', ${cls.schoolId}, ${cls.id});\n`;
            students.push({ id: sId, classId: cls.id });
        }
    }

    // 6. Grades (2400)
    sqlContent += `\n-- Scoring 2400 Academic Records\n`;
    for (const student of students) {
        const classSubjects = subjects.filter(s => s.classId === student.classId);
        for (const sub of classSubjects) {
            const score = faker.number.int({ min: 40, max: 95 });
            sqlContent += `INSERT INTO studentGrades (studentId, subjectId, classId, score) VALUES (${student.id}, ${sub.id}, ${student.classId}, ${score});\n`;
        }
    }

    fs.writeFileSync(OUTPUT_FILE, sqlContent);
    console.log(`✅ Success! Generated ${OUTPUT_FILE}`);
    console.log(`🚀 Next steps to deploy to remote D1:`);
    console.log(`   1. Run: npx wrangler d1 execute myAppD1 --remote --file=./seed-remote.sql`);
    console.log(`   2. Done!`);
}

main().catch((err) => {
    console.error('❌ Ecosystem deployment failed:', err);
    process.exit(1);
});
