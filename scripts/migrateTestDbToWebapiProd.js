import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const SOURCE_DB = process.env.MIGRATE_SOURCE_DB || "test";
const TARGET_DB = process.env.MIGRATE_TARGET_DB || "webapi_prod";

const BATCH_SIZE = Number.parseInt(process.env.MIGRATE_BATCH_SIZE || "500", 10);

const args = new Set(process.argv.slice(2));
const replaceTarget = args.has("--replace-target");
const dropSource = args.has("--drop-source");
const dropSourceOnly = args.has("--drop-source-only");

const stripServerFields = (idx) => {
  const { key, name, ...rest } = idx;
  const options = { ...rest };
  delete options.v;
  delete options.ns;
  return { key, name, options };
};

const copyIndexes = async (sourceColl, targetColl) => {
  const specs = await sourceColl.indexes();
  for (const idx of specs) {
    if (idx.name === "_id_") continue;
    const { key, name, options } = stripServerFields(idx);
    await targetColl.createIndex(key, { name, ...options });
  }
};

const copyCollection = async (sourceDb, targetDb, collName) => {
  const sourceColl = sourceDb.collection(collName);
  const targetColl = targetDb.collection(collName);

  const total = await sourceColl.estimatedDocumentCount();
  if (total === 0) {
    await copyIndexes(sourceColl, targetColl);
    return { inserted: 0 };
  }

  let inserted = 0;
  const cursor = sourceColl.find({}, { batchSize: BATCH_SIZE });

  let batch = [];
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await targetColl.insertMany(batch, { ordered: true });
      inserted += batch.length;
      batch = [];
      if (inserted % (BATCH_SIZE * 20) === 0) {
        console.log(`    … ${collName}: ${inserted} / ~${total}`);
      }
    }
  }
  if (batch.length > 0) {
    await targetColl.insertMany(batch, { ordered: true });
    inserted += batch.length;
  }

  await copyIndexes(sourceColl, targetColl);
  return { inserted };
};

const targetNonEmpty = async (targetDb) => {
  const cols = await targetDb.listCollections().toArray();
  for (const c of cols) {
    if (c.type !== "collection") continue;
    const n = await targetDb.collection(c.name).estimatedDocumentCount();
    if (n > 0) return true;
  }
  return false;
};

const dropDatabaseWithConfirm = async (client, dbName) => {
  const rl = readline.createInterface({ input, output });
  const typed = (await rl.question(`Type the database name "${dbName}" to confirm DROP (or leave empty to skip): `)).trim();
  rl.close();
  if (typed !== dbName) {
    console.log("Drop cancelled (name did not match).");
    return false;
  }
  await client.db(dbName).dropDatabase();
  console.log(`Dropped database "${dbName}".`);
  return true;
};

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  console.log(`Source: ${SOURCE_DB}`);
  console.log(`Target: ${TARGET_DB}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  if (replaceTarget) console.log("Flag: --replace-target (will empty target DB first)");
  if (dropSource) console.log("Flag: --drop-source (will prompt to drop source after copy)");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    if (dropSourceOnly) {
      console.log(`--drop-source-only: will prompt to drop "${SOURCE_DB}" (no copy).`);
      await dropDatabaseWithConfirm(client, SOURCE_DB);
      return;
    }

    const sourceDb = client.db(SOURCE_DB);
    const targetDb = client.db(TARGET_DB);

    const sourceCols = await sourceDb.listCollections().toArray();
    const collectionNames = sourceCols
      .filter((c) => c.type === "collection")
      .map((c) => c.name)
      .sort();

    if (collectionNames.length === 0) {
      throw new Error(`Source database "${SOURCE_DB}" has no collections. Nothing to copy.`);
    }

    const hasData = await targetNonEmpty(targetDb);
    if (hasData && !replaceTarget) {
      throw new Error(
        `Target "${TARGET_DB}" already has data. Re-run with --replace-target to drop it first, or pick another target name.`,
      );
    }

    if (replaceTarget) {
      const cols = await targetDb.listCollections().toArray();
      if (cols.length > 0) {
        console.log(`Dropping existing target database "${TARGET_DB}"…`);
        await targetDb.dropDatabase();
      }
    }

    console.log(`Copying ${collectionNames.length} collection(s)…`);

    for (const name of collectionNames) {
      const count = await sourceDb.collection(name).estimatedDocumentCount();
      console.log(`  → ${name} (~${count} docs)`);
      const { inserted } = await copyCollection(sourceDb, targetDb, name);
      console.log(`    done: ${inserted} document(s), indexes copied`);
    }

    console.log("\nMigration finished.");
    console.log(`Update MONGO_URI to use /${TARGET_DB} (e.g. …mongodb.net/${TARGET_DB}?retryWrites=…), then restart the API.`);

    if (dropSource) {
      console.log("\nOptional: remove the old database after you have verified the app against webapi_prod.");
      await dropDatabaseWithConfirm(client, SOURCE_DB);
    }
  } finally {
    await client.close();
  }
};

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
