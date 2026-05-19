import { Compression, IndexType, Permission } from 'node-appwrite';
import { APPWRITE } from './config.mjs';
import { COLLECTIONS, STORAGE_BUCKETS } from './schema.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse short permission strings like:
 *   'create("users")'           -> Permission.create(Role.users())
 *   'read("label:admin")'       -> Permission.read(Role.label('admin'))
 *   'update("user:abc123")'     -> Permission.update(Role.user('abc123'))
 */
function parsePermissions(strings = []) {
  return strings.map((raw) => {
    const match = raw.match(/^(read|create|update|delete|write)\("([^"]+)"\)$/);
    if (!match) throw new Error(`Invalid permission string: ${raw}`);
    const [, action, target] = match;
    const targetExpr = target.includes(':')
      ? `Role.${target.split(':')[0]}('${target.split(':').slice(1).join(':')}')`
      : `Role.${target}()`;
    return `Permission.${action}(${targetExpr})`;
  });
}

function buildPermissions(strings = []) {
  // We can build directly via Permission/Role helpers, but using the literal string form is easier.
  return strings.map((raw) => {
    const match = raw.match(/^(read|create|update|delete|write)\("([^"]+)"\)$/);
    if (!match) throw new Error(`Invalid permission string: ${raw}`);
    const [, action, target] = match;
    // Appwrite accepts string permissions in the form: 'create("role:value")' or
    // 'create("users")'. We just need to map our shorthand to that exact format.
    let normalized = target;
    if (target.includes(':')) {
      const [role, value] = target.split(':');
      normalized = `${role}:${value}`;
    }
    return `${action}("${normalized}")`;
  });
}

async function waitForAttributes(databases, collectionId) {
  for (let i = 0; i < 90; i++) {
    const collection = await databases.getCollection(APPWRITE.databaseId, collectionId);
    const pending = collection.attributes?.some((a) => a.status !== 'available');
    if (!pending) return collection;
    console.log(`  [${collectionId}] waiting for attributes...`);
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for attributes on ${collectionId}`);
}

async function ensureCollection(databases, def) {
  try {
    const existing = await databases.getCollection(APPWRITE.databaseId, def.id);
    console.log(`Collection "${def.id}" exists.`);
    return existing;
  } catch {
    await databases.createCollection(
      APPWRITE.databaseId,
      def.id,
      def.name,
      buildPermissions(def.collectionPermissions),
      Boolean(def.documentSecurity),
    );
    console.log(`Created collection "${def.id}".`);
    await sleep(1500);
    return databases.getCollection(APPWRITE.databaseId, def.id);
  }
}

async function ensureAttribute(databases, collectionId, attr, existingKeys) {
  if (existingKeys.has(attr.key)) {
    console.log(`  skip ${attr.type}: ${attr.key}`);
    return;
  }

  const db = APPWRITE.databaseId;
  switch (attr.type) {
    case 'string':
      await databases.createStringAttribute(
        db,
        collectionId,
        attr.key,
        attr.size,
        Boolean(attr.required),
        attr.default,
        Boolean(attr.array),
      );
      break;
    case 'enum':
      await databases.createEnumAttribute(
        db,
        collectionId,
        attr.key,
        attr.elements,
        Boolean(attr.required),
        attr.required ? undefined : attr.default,
        Boolean(attr.array),
      );
      break;
    case 'datetime':
      await databases.createDatetimeAttribute(
        db,
        collectionId,
        attr.key,
        Boolean(attr.required),
        attr.default,
        Boolean(attr.array),
      );
      break;
    case 'boolean':
      await databases.createBooleanAttribute(
        db,
        collectionId,
        attr.key,
        Boolean(attr.required),
        attr.default,
        Boolean(attr.array),
      );
      break;
    case 'integer':
      await databases.createIntegerAttribute(
        db,
        collectionId,
        attr.key,
        Boolean(attr.required),
        attr.min,
        attr.max,
        attr.default,
        Boolean(attr.array),
      );
      break;
    default:
      throw new Error(`Unknown attribute type: ${attr.type}`);
  }
  console.log(`  + ${attr.type}: ${attr.key}`);
  await sleep(1200);
}

async function ensureIndex(databases, collectionId, def, existingKeys) {
  if (existingKeys.has(def.key)) {
    console.log(`  skip index: ${def.key}`);
    return;
  }
  const type = def.type === 'fulltext' ? IndexType.Fulltext : IndexType.Key;
  await databases.createIndex(
    APPWRITE.databaseId,
    collectionId,
    def.key,
    type,
    def.attributes,
  );
  console.log(`  + index: ${def.key}`);
  await sleep(800);
}

async function syncCollection(databases, def) {
  console.log(`\n— ${def.id} —`);
  await ensureCollection(databases, def);

  const colWithAttrs = await databases.getCollection(APPWRITE.databaseId, def.id);
  const existingAttrKeys = new Set((colWithAttrs.attributes ?? []).map((a) => a.key));
  console.log('  attributes:');
  for (const attr of def.attributes) {
    await ensureAttribute(databases, def.id, attr, existingAttrKeys);
  }

  const ready = await waitForAttributes(databases, def.id);
  const existingIndexKeys = new Set((ready.indexes ?? []).map((i) => i.key));
  console.log('  indexes:');
  for (const idx of def.indexes ?? []) {
    await ensureIndex(databases, def.id, idx, existingIndexKeys);
  }

  return databases.getCollection(APPWRITE.databaseId, def.id);
}

async function ensureBucket(storage, def) {
  try {
    const existing = await storage.getBucket(def.id);
    console.log(`Bucket "${def.id}" exists.`);
    return existing;
  } catch {
    const compression =
      def.compression === 'gzip'
        ? Compression.Gzip
        : def.compression === 'zstd'
          ? Compression.Zstd
          : Compression.None;
    await storage.createBucket(
      def.id,
      def.name,
      buildPermissions(def.permissions),
      def.fileSecurity ?? false,
      true,
      def.maximumFileSize,
      def.allowedFileExtensions ?? [],
      compression,
      def.encryption ?? true,
      def.antivirus ?? true,
    );
    console.log(`Created bucket "${def.id}".`);
    return storage.getBucket(def.id);
  }
}

export async function syncStorage(storage) {
  console.log('\n— Storage —');
  for (const bucket of STORAGE_BUCKETS) {
    await ensureBucket(storage, bucket);
  }
}

export async function syncSchema(databases) {
  console.log(`Syncing schema → database ${APPWRITE.databaseId}`);
  const results = [];
  for (const def of COLLECTIONS) {
    results.push(await syncCollection(databases, def));
  }
  return results;
}

export async function getSchemaStatus(databases) {
  const summary = [];
  for (const def of COLLECTIONS) {
    try {
      const collection = await databases.getCollection(APPWRITE.databaseId, def.id);
      const attrs = new Set((collection.attributes ?? []).map((a) => a.key));
      const expected = def.attributes.map((a) => a.key);
      const missing = expected.filter((k) => !attrs.has(k));
      const indexes = (collection.indexes ?? []).map((i) => i.key);
      summary.push({ id: def.id, present: true, expected: expected.length, missing, indexes });
    } catch {
      summary.push({ id: def.id, present: false, expected: def.attributes.length, missing: [], indexes: [] });
    }
  }
  return summary;
}
