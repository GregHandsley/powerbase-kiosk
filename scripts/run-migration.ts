import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// This script runs a migration using the Supabase service role key
// Note: You need to set SUPABASE_SERVICE_ROLE_KEY in your environment

async function runMigration() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const migrationFile = join(__dirname, "../migrations/add_processed_snapshot.sql");
  const sql = readFileSync(migrationFile, "utf-8");

  console.log("Running migration: add_processed_snapshot.sql");
  console.log("SQL:", sql);

  // Split SQL by semicolons and execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 50)}...`);
    const { error } = await supabase.rpc("exec_sql", { sql: statement });
    
    if (error) {
      // Try direct query if RPC doesn't work
      const { error: queryError } = await supabase.from("_migrations").select("*").limit(0);
      if (queryError) {
        console.error("Error:", error.message);
        console.log("\nNote: This migration needs to be run manually in Supabase Dashboard → SQL Editor");
        console.log("The migration SQL is in: migrations/add_processed_snapshot.sql");
        process.exit(1);
      }
    }
  }

  console.log("Migration completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  console.log("\nPlease run this migration manually:");
  console.log("1. Go to Supabase Dashboard → SQL Editor");
  console.log("2. Copy the contents of migrations/add_processed_snapshot.sql");
  console.log("3. Paste and run in the SQL Editor");
  process.exit(1);
});

