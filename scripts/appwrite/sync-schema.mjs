import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import { APPWRITE } from './config.mjs';
import { JOB_CARDS_COLLECTION } from './schema.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForAttributes(databases, collectionId) {
  for (let i = 0; i < 60; i++) {
    const collection = await databases.getCollection(APPWRITE.databaseId, collectionId);
    const pending = collection.attributes?.some((a) => a.status !== 'available');
    if (!pending) return collection;
    console.log('  Waiting for attributes...');
    await sleep(2000);
  }
  throw new Error('Timed out waiting for attributes');
}

async function ensureCollection(databases) {
  const { id, name, documentSecurity } = JOB_CARDS_COLLECTION;
  try {
    const existing = await databases.getCollection(APPWRITE.databaseId, id);
    console.log(`Collection "${id}" exists.`);
    return existing;
  } catch {
    await databases.createCollection(
      APPWRITE.databaseId,
      id,
      name,
      [Permission.create(Role.users())],
      documentSecurity,
    );
    console.log(`Created collection "${id}".`);
    await sleep(1500);
    return databases.getCollection(APPWRITE.databaseId, id);
  }
}

async function ensureStringAttributes(databases, collectionId, existingKeys) {
  for (const attr of JOB_CARDS_COLLECTION.stringAttributes) {
    if (existingKeys.has(attr.key)) {
      console.log(`  skip string: ${attr.key}`);
      continue;
    }
    await databases.createStringAttribute(
      APPWRITE.databaseId,
      collectionId,
      attr.key,
      attr.size,
      attr.required,
    );
    console.log(`  + string: ${attr.key}`);
    await sleep(1200);
  }
}

async function ensureEnumAttributes(databases, collectionId, existingKeys) {
  for (const attr of JOB_CARDS_COLLECTION.enumAttributes) {
    if (existingKeys.has(attr.key)) {
      console.log(`  skip enum: ${attr.key}`);
      continue;
    }
    await databases.createEnumAttribute(
      APPWRITE.databaseId,
      collectionId,
      attr.key,
      attr.elements,
      attr.required,
      attr.required ? undefined : attr.default,
    );
    console.log(`  + enum: ${attr.key}`);
    await sleep(1200);
  }
}

async function ensureIndexes(databases, collectionId, existingIndexAttrs) {
  for (const key of JOB_CARDS_COLLECTION.indexes) {
    if (existingIndexAttrs.has(key)) {
      console.log(`  skip index: ${key}`);
      continue;
    }
    await databases.createIndex(
      APPWRITE.databaseId,
      collectionId,
      `${key}_idx`,
      IndexType.Key,
      [key],
    );
    console.log(`  + index: ${key}`);
    await sleep(800);
  }
}

export async function syncSchema(databases) {
  console.log(`Syncing schema → database ${APPWRITE.databaseId}\n`);

  let collection = await ensureCollection(databases);
  const existingKeys = new Set((collection.attributes ?? []).map((a) => a.key));

  console.log('\nAttributes:');
  await ensureStringAttributes(databases, JOB_CARDS_COLLECTION.id, existingKeys);
  await ensureEnumAttributes(databases, JOB_CARDS_COLLECTION.id, existingKeys);

  console.log('\nProcessing...');
  collection = await waitForAttributes(databases, JOB_CARDS_COLLECTION.id);

  const indexKeys = new Set((collection.indexes ?? []).map((i) => i.attributes?.[0]));
  console.log('\nIndexes:');
  await ensureIndexes(databases, JOB_CARDS_COLLECTION.id, indexKeys);

  return databases.getCollection(APPWRITE.databaseId, JOB_CARDS_COLLECTION.id);
}

export async function getSchemaStatus(databases) {
  const collection = await databases.getCollection(
    APPWRITE.databaseId,
    JOB_CARDS_COLLECTION.id,
  );

  const attrs = new Set((collection.attributes ?? []).map((a) => a.key));
  const expected = [
    ...JOB_CARDS_COLLECTION.stringAttributes.map((a) => a.key),
    ...JOB_CARDS_COLLECTION.enumAttributes.map((a) => a.key),
  ];

  const missing = expected.filter((k) => !attrs.has(k));
  const indexes = (collection.indexes ?? []).map((i) => i.attributes?.[0]).filter(Boolean);

  return { collection, missing, indexes, expected };
}
