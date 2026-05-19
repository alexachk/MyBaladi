import { Client, ID, Query, Users } from 'node-appwrite';

const ADMIN_LABEL = 'admin';
const APP_DEV_LABEL = 'appdev';

function hasManagementAccess(labels) {
  return (labels ?? []).includes(APP_DEV_LABEL);
}

function adminClient(req) {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? process.env.APPWRITE_API_KEY);
}

async function requireAdmin(req, res) {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    return { error: res.json({ ok: false, error: 'Sign in required.' }, 401) };
  }

  const users = new Users(adminClient(req));
  const caller = await users.get(userId);
  if (!hasManagementAccess(caller.labels)) {
    return { error: res.json({ ok: false, error: 'App Dev access required.' }, 403) };
  }

  return { users, caller };
}

function parseBody(req) {
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

function normalizeList(values, { lowercase = false } = {}) {
  const seen = new Set();
  const out = [];
  const source = Array.isArray(values) ? values : [];
  for (const raw of source) {
    const v = lowercase ? String(raw ?? '').trim().toLowerCase() : String(raw ?? '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function readStoredList(prefs, key, { lowercase = false } = {}) {
  const raw = prefs?.[key];
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return normalizeList(raw, { lowercase });
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeList(parsed, { lowercase });
    } catch {
      return normalizeList([raw], { lowercase });
    }
  }
  return [];
}

function publicUser(user) {
  const prefs = user.prefs ?? {};
  const labels = user.labels ?? [];
  const storedPosition = prefs.position ?? '';
  const position = labels.includes(APP_DEV_LABEL) ? 'App Dev' : storedPosition;
  return {
    id: user.$id,
    email: user.email,
    name: user.name ?? '',
    firstName: prefs.firstName ?? '',
    lastName: prefs.lastName ?? '',
    position,
    managerId: prefs.managerId ?? '',
    contactPhones: readStoredList(prefs, 'contactPhones'),
    contactEmails: readStoredList(prefs, 'contactEmails', { lowercase: true }),
    labels,
    status: user.status,
  };
}

export default async ({ req, res, log, error }) => {
  try {
    const body = parseBody(req);
    const action = body.action;

    // Public (authenticated) action — any signed-in user can list personnel.
    if (action === 'list-personnel') {
      const callerId = req.headers['x-appwrite-user-id'];
      if (!callerId) {
        return res.json({ ok: false, error: 'Sign in required.' }, 401);
      }
      const users = new Users(adminClient(req));
      const list = await users.list([Query.orderAsc('name'), Query.limit(200)]);
      return res.json({
        ok: true,
        personnel: list.users.map((u) => {
          const labels = u.labels ?? [];
          const storedPosition = u.prefs?.position ?? '';
          return {
            id: u.$id,
            name: u.name ?? '',
            email: u.email,
            labels,
            position: labels.includes(APP_DEV_LABEL) ? 'App Dev' : storedPosition,
            managerId: u.prefs?.managerId ?? '',
            contactPhones: readStoredList(u.prefs, 'contactPhones'),
            contactEmails: readStoredList(u.prefs, 'contactEmails', { lowercase: true }),
          };
        }),
      });
    }

    const gate = await requireAdmin(req, res);
    if (gate.error) return gate.error;

    const { users } = gate;

    switch (action) {
      case 'list': {
        const list = await users.list([Query.orderDesc('$createdAt'), Query.limit(100)]);
        return res.json({ ok: true, users: list.users.map(publicUser) });
      }
      case 'create': {
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');
        const firstName = String(body.firstName ?? '').trim();
        const lastName = String(body.lastName ?? '').trim();
        const position = String(body.position ?? '').trim();
        const managerId = String(body.managerId ?? '').trim();
        const contactPhones = normalizeList(body.contactPhones ?? []);
        const contactEmails = normalizeList(body.contactEmails ?? [], { lowercase: true });
        const name = `${firstName} ${lastName}`.trim() || String(body.name ?? '').trim();
        const grantAdmin = Boolean(body.grantAdmin);

        if (!email || !password) {
          return res.json({ ok: false, error: 'Email and password are required.' }, 400);
        }
        if (password.length < 8) {
          return res.json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
        }
        for (const mail of contactEmails) {
          if (!mail.includes('@')) {
            return res.json({ ok: false, error: 'Each contact email must be valid.' }, 400);
          }
        }

        const created = await users.create({
          userId: ID.unique(),
          email,
          password,
          name: name || undefined,
        });

        if (firstName || lastName || position || managerId || contactPhones.length || contactEmails.length) {
          const updated = await users.updatePrefs(created.$id, {
            firstName,
            lastName,
            position,
            managerId,
            contactPhones: JSON.stringify(contactPhones),
            contactEmails: JSON.stringify(contactEmails),
          });
          created.prefs = updated.prefs;
        }

        if (grantAdmin) {
          await users.updateLabels(created.$id, [ADMIN_LABEL]);
          created.labels = [ADMIN_LABEL];
        }

        if (position === 'App Dev') {
          const labels = Array.from(new Set([...(created.labels ?? []), APP_DEV_LABEL]));
          await users.updateLabels(created.$id, labels);
          created.labels = labels;
        }

        return res.json({ ok: true, user: publicUser(created) });
      }
      case 'update-profile': {
        const userId = String(body.userId ?? '');
        if (!userId) {
          return res.json({ ok: false, error: 'User id is required.' }, 400);
        }
        const firstName = String(body.firstName ?? '').trim();
        const lastName = String(body.lastName ?? '').trim();
        const position = String(body.position ?? '').trim();
        const managerId = String(body.managerId ?? '').trim();
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');
        const contactPhones = normalizeList(body.contactPhones ?? []);
        const contactEmails = normalizeList(body.contactEmails ?? [], { lowercase: true });
        const fullName = `${firstName} ${lastName}`.trim();

        const target = await users.get(userId);
        const callerId = req.headers['x-appwrite-user-id'];
        const wasAppDev = (target.labels ?? []).includes(APP_DEV_LABEL);
        if (callerId === userId && wasAppDev && position !== 'App Dev') {
          return res.json({ ok: false, error: 'You cannot change your own App Dev role.' }, 400);
        }

        if (email && !email.includes('@')) {
          return res.json({ ok: false, error: 'Valid email is required.' }, 400);
        }
        if (password && password.length < 8) {
          return res.json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
        }

        for (const mail of contactEmails) {
          if (!mail.includes('@')) {
            return res.json({ ok: false, error: 'Each contact email must be valid.' }, 400);
          }
        }

        if (fullName) await users.updateName(userId, fullName);
        if (email && email !== target.email) {
          await users.updateEmail(userId, email);
        }
        if (password) {
          await users.updatePassword(userId, password);
        }
        const nextPrefs = {
          ...(target.prefs ?? {}),
          firstName,
          lastName,
          position,
          managerId,
          contactPhones: JSON.stringify(contactPhones),
          contactEmails: JSON.stringify(contactEmails),
        };
        await users.updatePrefs(userId, nextPrefs);

        const labels = new Set(target.labels ?? []);
        if (position === 'App Dev') labels.add(APP_DEV_LABEL);
        else labels.delete(APP_DEV_LABEL);
        await users.updateLabels(userId, Array.from(labels));

        const result = await users.get(userId);
        return res.json({ ok: true, user: publicUser(result) });
      }
      case 'set-admin': {
        const userId = String(body.userId ?? '');
        const enabled = Boolean(body.enabled);
        if (!userId) {
          return res.json({ ok: false, error: 'User id is required.' }, 400);
        }

        const target = await users.get(userId);
        const labels = new Set(target.labels ?? []);
        if (enabled) labels.add(ADMIN_LABEL);
        else labels.delete(ADMIN_LABEL);

        const updated = await users.updateLabels(userId, Array.from(labels));
        return res.json({ ok: true, user: publicUser(updated) });
      }
      case 'set-app-dev': {
        const userId = String(body.userId ?? '');
        const enabled = Boolean(body.enabled);
        if (!userId) {
          return res.json({ ok: false, error: 'User id is required.' }, 400);
        }

        const target = await users.get(userId);
        const labels = new Set(target.labels ?? []);
        if (enabled) labels.add(APP_DEV_LABEL);
        else labels.delete(APP_DEV_LABEL);

        const updated = await users.updateLabels(userId, Array.from(labels));
        if (enabled) {
          const prefs = { ...(updated.prefs ?? {}), position: 'App Dev' };
          await users.updatePrefs(userId, prefs);
        }
        const result = await users.get(userId);
        return res.json({ ok: true, user: publicUser(result) });
      }
      case 'delete': {
        const userId = String(body.userId ?? '');
        if (!userId) {
          return res.json({ ok: false, error: 'User id is required.' }, 400);
        }
        if (userId === req.headers['x-appwrite-user-id']) {
          return res.json({ ok: false, error: 'You cannot delete your own account.' }, 400);
        }

        await users.delete(userId);
        return res.json({ ok: true });
      }
      default:
        return res.json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    error(err?.message ?? err);
    return res.json({ ok: false, error: err?.message ?? 'Server error.' }, 500);
  }
};
