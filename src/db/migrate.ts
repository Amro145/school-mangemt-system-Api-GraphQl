import { migrate } from "drizzle-orm/better-sqlite3/migrator";
// أضف الامتداد .ts أو تأكد من صحة المسار
import { db, sqlite } from "./index";

async function runMigrations() {
    console.log("⏳ Running migrations...");
    try {
        // المسار هنا يجب أن يشير للمجلد الذي تم إنشاؤه بواسطة generate
        await migrate(db, { migrationsFolder: "drizzle/migrations" });
        console.log("✅ Migrations completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        sqlite.close();
    }
}

runMigrations();