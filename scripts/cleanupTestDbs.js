import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const KEEP_PREFIXES = ["webapi_test"];

const shouldKeepByDefault = (name) => KEEP_PREFIXES.includes(name);

const askYesNo = async (rl, question) => {
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
};

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases();

    const candidates = databases
      .map((d) => d.name)
      .filter((name) => name.startsWith("webapi_"))
      .sort();

    if (candidates.length === 0) {
      console.log("No databases starting with 'webapi_' found. Nothing to clean up.");
      return;
    }

    console.log("\nDatabases starting with 'webapi_':");
    for (const name of candidates) {
      const note = shouldKeepByDefault(name) ? "  (recommended to keep)" : "";
      console.log(`  - ${name}${note}`);
    }
    console.log("");

    const rl = readline.createInterface({ input, output });

    let dropped = 0;
    let skipped = 0;

    for (const name of candidates) {
      if (shouldKeepByDefault(name)) {
        const drop = await askYesNo(rl, `Drop '${name}'? (recommended: keep)`);
        if (!drop) {
          skipped += 1;
          console.log(`  kept ${name}`);
          continue;
        }
      } else {
        const drop = await askYesNo(rl, `Drop '${name}'?`);
        if (!drop) {
          skipped += 1;
          console.log(`  kept ${name}`);
          continue;
        }
      }

      await client.db(name).dropDatabase();
      dropped += 1;
      console.log(`  dropped ${name}`);
    }

    rl.close();

    console.log(`\nDone. Dropped: ${dropped}, kept: ${skipped}.`);
  } finally {
    await client.close();
  }
};

main().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
});
