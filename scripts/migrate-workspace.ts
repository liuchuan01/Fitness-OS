import { migrateLegacyWorkspace } from "../server/workspace-migration.js";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error(
    "Usage: npx tsx scripts/migrate-workspace.ts <legacy-root> <empty-external-workspace>"
  );
console.log(JSON.stringify(await migrateLegacyWorkspace(source, destination), null, 2));
