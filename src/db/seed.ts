import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.dev.vars' });
dotenv.config();

async function main() {
    console.log('🌱 Starting seed process...');

    let dbUrl = process.env.DB_URL;

    if (!dbUrl) {
        // Attempt to find local Wrangler D1 file
        const wranglerStateDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

        if (fs.existsSync(wranglerStateDir)) {
            const files = fs.readdirSync(wranglerStateDir).filter(f => f.endsWith('.sqlite'));
            if (files.length > 0) {
                // Use the most recently modified file or just the first one
                const dbPath = path.join(wranglerStateDir, files[0]);
                console.log(`📍 Found local Wrangler D1 database: ${dbPath}`);
                dbUrl = `file:${dbPath}`;
            }
        }
    }

    if (!dbUrl) {
        console.error('❌ Error: DB_URL not found in environment and could not auto-discover local D1 database.');
        console.error('Please set DB_URL in .env or ensure you have run "wrangler dev" at least once to create the local database.');
        process.exit(1);
    }

    const client = createClient({ url: dbUrl });
    const db = drizzle(client, { schema });

    console.log('🧹 Clean Start: Deleting all existing data...');

    // Strict order requires deleting dependent tables first
    // Order: studentGrades -> subject -> classRoom -> school -> user
    // Only user is tricky because of circular deps, but we delete child tables first.

    // Break circular dependency: user.schoolId -> school.id -> user.id
    console.log('🔄 Breaking circular dependencies...');
    await db.update(schema.user).set({ schoolId: null });

    await db.delete(schema.studentGrades);
    await db.delete(schema.subject);
    await db.delete(schema.classRoom);
    await db.delete(schema.school);
    await db.delete(schema.user);

    console.log('✅ Data cleaned.');

    console.log('👤 Creating Admin & School...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Admin (initially without schoolId)
    const [admin] = await db.insert(schema.user).values({
        userName: 'Super Admin',
        email: 'admin@school.com',
        password: hashedPassword,
        role: 'admin',
    }).returning();

    if (!admin) throw new Error('Failed to create admin');

    // 2. Create School linked to Admin
    const [newItem] = await db.insert(schema.school).values({
        name: 'Cloudflare High School',
        adminId: admin.id,
    }).returning();

    const schoolId = newItem.id;

    // 3. Update Admin with schoolId
    await db.update(schema.user)
        .set({ schoolId: schoolId })
        .where(eq(schema.user.id, admin.id));

    console.log(`🏫 School created: Cloudflare High School (ID: ${schoolId})`);
    console.log(`👤 Admin updated with School ID.`);

    // 4. Create 5 Classrooms
    console.log('🏫 Creating 5 Classrooms...');
    const classRooms = [];
    for (let i = 1; i <= 5; i++) {
        const [c] = await db.insert(schema.classRoom).values({
            name: `Grade ${10 + i} - Section ${faker.helpers.arrayElement(['A', 'B'])}`,
            schoolId: schoolId,
        }).returning();
        classRooms.push(c);
    }

    // 5. Create 10 Teachers
    console.log('👨‍🏫 Creating 10 Teachers...');
    const teachers = [];
    for (let i = 0; i < 10; i++) {
        const [t] = await db.insert(schema.user).values({
            userName: faker.person.fullName(),
            email: faker.internet.email(),
            password: hashedPassword,
            role: 'teacher',
            schoolId: schoolId,
        }).returning();
        teachers.push(t);
    }

    // 6. Create Subjects (2 per classroom)
    console.log('📚 Creating Subjects for Classrooms...');
    const subjects = [];
    for (const room of classRooms) {
        // Create 2 subjects for this room
        // Assign a random teacher from the school's teachers
        for (const subjName of ['Mathematics', 'Science']) { // Or random
            const teacher = faker.helpers.arrayElement(teachers);
            const [s] = await db.insert(schema.subject).values({
                name: subjName === 'Mathematics' ? 'Mathematics' : 'Science', // Just simple logic or use faker
                classId: room.id,
                teacherId: teacher.id,
            }).returning();
            subjects.push(s);
        }
        // Add some variety
        const extraSubj = await db.insert(schema.subject).values({
            name: faker.helpers.arrayElement(['History', 'English', 'Art', 'Physics']),
            classId: room.id,
            teacherId: faker.helpers.arrayElement(teachers).id,
        }).returning();
        subjects.push(extraSubj[0]);
    }

    // 7. Create 50 Students
    console.log('🎓 Creating 50 Students...');
    const students = [];
    for (let i = 0; i < 50; i++) {
        const assignedClass = faker.helpers.arrayElement(classRooms);
        const [st] = await db.insert(schema.user).values({
            userName: faker.person.fullName(),
            email: faker.internet.email(),
            password: hashedPassword,
            role: 'student',
            schoolId: schoolId,
            classId: assignedClass.id,
        }).returning();
        students.push(st);
    }

    // 8. Generate Grades
    console.log('📝 Generating Grades...');
    // For each student, find subjects in their class, and give them a grade
    let gradeCount = 0;
    for (const st of students) {
        if (!st.classId) continue;

        // Find subjects for this class
        // We can query db or valid from our local arrays 'subjects'
        const classSubjects = subjects.filter(s => s.classId === st.classId);

        for (const sub of classSubjects) {
            await db.insert(schema.studentGrades).values({
                studentId: st.id,
                subjectId: sub.id,
                classId: st.classId,
                score: faker.number.int({ min: 50, max: 100 }),
            });
            gradeCount++;
        }
    }

    console.log(`✅ Seed completed! Generated ${gradeCount} grades.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
