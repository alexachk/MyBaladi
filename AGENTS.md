# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Appwrite backend changes

**Never ask the user to manually create collections, attributes, or indexes in the Appwrite Console.**

All Appwrite-side schema and infrastructure changes must go through the admin API scripts:

- Schema definition: `scripts/appwrite/schema.mjs`
- Sync to remote: `npm run appwrite:sync`
- Check remote state: `npm run appwrite:status`

Requires `APPWRITE_API_KEY` in `.env` (server-only, never commit).

When adding new app features that need Appwrite resources, update `schema.mjs` and run `appwrite:sync`.
