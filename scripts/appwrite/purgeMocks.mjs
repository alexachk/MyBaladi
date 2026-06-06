/** Best-effort delete of retired demo document ids. */

export async function deleteDocumentIfExists(databases, databaseId, collectionId, documentId) {
  try {
    await databases.deleteDocument(databaseId, collectionId, documentId);
    console.log(`Deleted  ${collectionId}/${documentId}`);
    return true;
  } catch (err) {
    if (err.code === 404) return false;
    throw err;
  }
}

export async function purgeLegacyMocks(databases, databaseId, { companies, persons, jobs }) {
  let removed = 0;
  for (const id of companies ?? []) {
    if (await deleteDocumentIfExists(databases, databaseId, 'companies', id)) removed += 1;
  }
  for (const id of persons ?? []) {
    if (await deleteDocumentIfExists(databases, databaseId, 'persons', id)) removed += 1;
  }
  for (const id of jobs ?? []) {
    if (await deleteDocumentIfExists(databases, databaseId, 'job_cards', id)) removed += 1;
  }
  return removed;
}
