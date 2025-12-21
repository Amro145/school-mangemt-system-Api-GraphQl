import DataLoader from 'dataloader';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, and } from 'drizzle-orm';
import * as dbSchema from './db/schema';
import { user, classRoom } from './db/schema';

type DB = ReturnType<typeof drizzle<typeof dbSchema>>;

export const createLoaders = (db: DB) => {
    return {
        classRoomsLoader: new DataLoader(async (schoolIds: readonly number[]) => {
            const rows = await db.select().from(classRoom).where(inArray(classRoom.schoolId, [...schoolIds])).all();

            const grouped = schoolIds.map(id => rows.filter(r => r.schoolId === id));
            return grouped;
        }),

        studentsLoader: new DataLoader(async (classIds: readonly number[]) => {
            const rows = await db.select().from(user).where(
                and(
                    inArray(user.classId, [...classIds]),
                    eq(user.role, 'student')
                )
            ).all();

            // Group by classId
            const grouped = classIds.map(id => rows.filter(r => r.classId === id));
            return grouped;
        }),

        // Optional: useful for deep query (ClassRoom -> Subjects)
        subjectsLoader: new DataLoader(async (classIds: readonly number[]) => {
            const rows = await db.select().from(dbSchema.subject).where(inArray(dbSchema.subject.classId, [...classIds])).all();
            const grouped = classIds.map(id => rows.filter(r => r.classId === id));
            return grouped;
        }),
    };
};

export type Loaders = ReturnType<typeof createLoaders>;
