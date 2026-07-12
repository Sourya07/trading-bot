import { pool } from "./db";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  console.log("Running Neon DB migrations...");
  try {
    const sql = readFileSync(join(__dirname, "neon_init.sql"), "utf-8");
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log("Migrations completed successfully.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  }
}
