import { Client, Query, Users } from 'node-appwrite';

const ADMIN_LABEL = 'admin';
const APP_DEV_LABEL = 'appdev';

function adminClient() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

function readPushTokens(prefs) {
  const tokens = new Set();
  if (Array.isArray(prefs?.expoPushTokens)) {
    for (const raw of prefs.expoPushTokens) {
      const t = String(raw ?? '').trim();
      if (t) tokens.add(t);
    }
  }
  const legacy = String(prefs?.expoPushToken ?? '').trim();
  if (legacy) tokens.add(legacy);
  return tokens;
}

async function collectUserTokens(users, userId, out) {
  if (!userId) return;
  try {
    const user = await users.get(userId);
    for (const token of readPushTokens(user.prefs)) out.add(token);
  } catch {
    // user removed or unavailable
  }
}

async function collectAdminTokens(users, out) {
  let cursor = null;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const page = await users.list(queries);
    for (const user of page.users) {
      const labels = user.labels ?? [];
      if (!labels.includes(ADMIN_LABEL) && !labels.includes(APP_DEV_LABEL)) continue;
      for (const token of readPushTokens(user.prefs)) out.add(token);
    }

    if (page.users.length < 100) break;
    cursor = page.users[page.users.length - 1]?.$id ?? null;
    if (!cursor) break;
  }
}

async function sendExpoPush(messages) {
  if (!messages.length) return { ok: true, sent: 0 };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Expo push failed (${res.status})`);
  }

  return res.json();
}

export default async ({ req, res, log, error }) => {
  const event = req.headers['x-appwrite-event'] ?? '';
  if (!event.includes('.create')) {
    return res.json({ ok: true, skipped: true });
  }

  let doc;
  try {
    doc = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ ok: false, error: 'Invalid payload.' }, 400);
  }

  const users = new Users(adminClient());
  const tokens = new Set();

  if (doc.recipientScope === 'user') {
    await collectUserTokens(users, doc.recipientUserId, tokens);
  } else if (doc.recipientScope === 'admin') {
    await collectAdminTokens(users, tokens);
  }

  if (!tokens.size) {
    log('No push tokens for notification recipients.');
    return res.json({ ok: true, sent: 0 });
  }

  const messages = [...tokens].map((to) => ({
    to,
    title: doc.title || 'MyBaladi',
    body: doc.body || '',
    sound: 'default',
    channelId: 'default',
    data: {
      jobId: doc.jobId ?? '',
      notificationId: doc.$id ?? '',
    },
  }));

  try {
    const result = await sendExpoPush(messages);
    log(`Sent ${messages.length} push message(s).`);
    return res.json({ ok: true, sent: messages.length, result });
  } catch (e) {
    error(e?.message ?? String(e));
    return res.json({ ok: false, error: e?.message ?? 'Push send failed.' }, 500);
  }
};
