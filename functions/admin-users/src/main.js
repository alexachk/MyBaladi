import { Client, ID, Query, Users } from 'node-appwrite';

const ADMIN_LABEL = 'admin';

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
  if (!(caller.labels ?? []).includes(ADMIN_LABEL)) {
    return { error: res.json({ ok: false, error: 'Administrator access required.' }, 403) };
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

function publicUser(user) {
  const prefs = user.prefs ?? {};
  return {
    id: user.$id,
    email: user.email,
    name: user.name ?? '',
    firstName: prefs.firstName ?? '',
    lastName: prefs.lastName ?? '',
    position: prefs.position ?? '',
    labels: user.labels ?? [],
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
        personnel: list.users.map((u) => ({
          id: u.$id,
          name: u.name ?? '',
          email: u.email,
          labels: u.labels ?? [],
          position: u.prefs?.position ?? '',
        })),
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
        const name = `${firstName} ${lastName}`.trim() || String(body.name ?? '').trim();
        const grantAdmin = Boolean(body.grantAdmin);

        if (!email || !password) {
          return res.json({ ok: false, error: 'Email and password are required.' }, 400);
        }
        if (password.length < 8) {
          return res.json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
        }

        const created = await users.create({
          userId: ID.unique(),
          email,
          password,
          name: name || undefined,
        });

        if (firstName || lastName || position) {
          const updated = await users.updatePrefs(created.$id, {
            firstName,
            lastName,
            position,
          });
          created.prefs = updated.prefs;
        }

        if (grantAdmin) {
          await users.updateLabels(created.$id, [ADMIN_LABEL]);
          created.labels = [ADMIN_LABEL];
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
        const fullName = `${firstName} ${lastName}`.trim();

        if (fullName) await users.updateName(userId, fullName);
        const target = await users.get(userId);
        const nextPrefs = { ...(target.prefs ?? {}), firstName, lastName, position };
        const updated = await users.updatePrefs(userId, nextPrefs);
        const result = await users.get(userId);
        result.prefs = updated.prefs;
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
