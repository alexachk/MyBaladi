import { Client, Databases, ID, Query, Users } from 'node-appwrite';

const ADMIN_LABEL = 'admin';
const APP_DEV_LABEL = 'appdev';
const LEAD_LABEL = 'lead';

const LEAD_POSITIONS = new Set(['Supervisor', 'Operations Manager']);

function applyLeadLabel(labels, position) {
  const next = new Set(labels ?? []);
  if (LEAD_POSITIONS.has(position)) next.add(LEAD_LABEL);
  else if (position === 'Technician') next.delete(LEAD_LABEL);
  return Array.from(next);
}

function canDeleteClientUser(caller) {
  const labels = caller.labels ?? [];
  if (labels.includes(ADMIN_LABEL) || labels.includes(APP_DEV_LABEL) || labels.includes(LEAD_LABEL)) {
    return true;
  }
  const position = caller.prefs?.position ?? '';
  return LEAD_POSITIONS.has(position);
}

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

function getManagerChain(userId, members) {
  const chain = [];
  let current = members.find((m) => m.id === userId);
  while (current?.managerId) {
    if (!chain.includes(current.managerId)) chain.push(current.managerId);
    current = members.find((m) => m.id === current.managerId);
  }
  return chain;
}

function managerIdsForJob(ownerId, assigneeIds, members) {
  const ids = new Set();
  for (const id of getManagerChain(ownerId, members)) ids.add(id);
  for (const assigneeId of assigneeIds) {
    if (!assigneeId) continue;
    for (const id of getManagerChain(assigneeId, members)) ids.add(id);
  }
  return [...ids];
}

async function resolveJobCardAccess(req, body) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    return { error: 'Sign in required.', status: 401 };
  }

  const documentId = String(body.documentId ?? '').trim();
  const ownerId = String(body.ownerId ?? '').trim();
  const databaseId = String(body.databaseId ?? '').trim();
  const collectionId = String(body.collectionId ?? '').trim();
  const assigneeIds = normalizeList(body.assigneeIds ?? []);

  if (!documentId || !ownerId || !databaseId || !collectionId) {
    return { error: 'Missing job permission parameters.', status: 400 };
  }

  const users = new Users(adminClient(req));
  const list = await users.list([Query.orderAsc('name'), Query.limit(200)]);
  const members = list.users.map((u) => {
    const labels = u.labels ?? [];
    const storedPosition = u.prefs?.position ?? '';
    return {
      id: u.$id,
      managerId: u.prefs?.managerId ?? '',
      labels,
      position: labels.includes(APP_DEV_LABEL) ? 'App Dev' : storedPosition,
    };
  });

  const managerIds = managerIdsForJob(ownerId, assigneeIds, members);
  const caller = await users.get(callerId);
  const callerLabels = caller.labels ?? [];
  const isPrivileged =
    callerLabels.includes(ADMIN_LABEL) || callerLabels.includes(APP_DEV_LABEL);
  const mayManage =
    isPrivileged ||
    callerId === ownerId ||
    assigneeIds.includes(callerId) ||
    managerIds.includes(callerId);

  return {
    callerId,
    isPrivileged,
    mayManage,
    managerIds,
    documentId,
    ownerId,
    databaseId,
    collectionId,
    assigneeIds,
    members,
  };
}

function mayDeleteJobCard(access, { reviewStatus, status, lockedAt }) {
  if (access.isPrivileged) return true;
  if (access.managerIds.includes(access.callerId)) return true;
  const participant =
    access.callerId === access.ownerId || access.assigneeIds.includes(access.callerId);
  if (!participant) return false;
  if (status === 'completed') return false;
  if (lockedAt) return false;
  if (reviewStatus === 'approved') return false;
  return true;
}

function buildJobCardPermissionStrings(ownerId, assigneeIds, managerIds) {
  const perms = [];
  const editorIds = new Set(
    [ownerId, ...(Array.isArray(assigneeIds) ? assigneeIds : []), ...managerIds].filter(Boolean),
  );
  const deleteIds = new Set(
    [ownerId, ...(Array.isArray(assigneeIds) ? assigneeIds : []), ...managerIds].filter(Boolean),
  );
  for (const id of editorIds) {
    perms.push(`read("user:${id}")`, `update("user:${id}")`);
  }
  for (const id of deleteIds) {
    perms.push(`delete("user:${id}")`);
  }
  for (const label of ['admin', 'appdev']) {
    perms.push(`read("label:${label}")`, `update("label:${label}")`, `delete("label:${label}")`);
  }
  return perms;
}

function buildRecapPermissionStrings(ownerId, readerIds) {
  const perms = [];
  if (ownerId) {
    perms.push(
      `read("user:${ownerId}")`,
      `update("user:${ownerId}")`,
      `delete("user:${ownerId}")`,
    );
  }
  for (const id of normalizeList(readerIds ?? [])) {
    if (!id || id === ownerId) continue;
    perms.push(`read("user:${id}")`);
  }
  for (const label of ['admin', 'appdev']) {
    perms.push(`read("label:${label}")`, `update("label:${label}")`, `delete("label:${label}")`);
  }
  return perms;
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

    if (action === 'sync-recap-permissions') {
      const callerId = req.headers['x-appwrite-user-id'];
      if (!callerId) {
        return res.json({ ok: false, error: 'Sign in required.' }, 401);
      }

      const documentId = String(body.documentId ?? '').trim();
      const ownerId = String(body.ownerId ?? '').trim();
      const databaseId = String(body.databaseId ?? '').trim();
      const collectionId = String(body.collectionId ?? '').trim();
      const readerIds = normalizeList(body.readerIds ?? []);

      if (!documentId || !ownerId || !databaseId || !collectionId) {
        return res.json({ ok: false, error: 'Missing recap permission parameters.' }, 400);
      }

      if (callerId !== ownerId && !readerIds.includes(callerId)) {
        const users = new Users(adminClient(req));
        const caller = await users.get(callerId);
        const labels = caller.labels ?? [];
        const isPrivileged = labels.includes(ADMIN_LABEL) || labels.includes(APP_DEV_LABEL);
        if (!isPrivileged) {
          return res.json({ ok: false, error: 'Not allowed to update recap permissions.' }, 403);
        }
      }

      const databases = new Databases(adminClient(req));
      await databases.updateDocument(
        databaseId,
        collectionId,
        documentId,
        {},
        buildRecapPermissionStrings(ownerId, readerIds),
      );

      return res.json({ ok: true });
    }

    if (action === 'sync-job-permissions' || action === 'delete-job-card') {
      const access = await resolveJobCardAccess(req, body);
      if (access.error) {
        return res.json({ ok: false, error: access.error }, access.status);
      }

      if (!access.mayManage) {
        const msg =
          action === 'delete-job-card'
            ? 'Not allowed to delete this job card.'
            : 'Not allowed to update job permissions.';
        return res.json({ ok: false, error: msg }, 403);
      }

      const databases = new Databases(adminClient(req));

      if (action === 'delete-job-card') {
        const reviewStatus = String(body.reviewStatus ?? 'none');
        const status = String(body.status ?? '');
        const lockedAt = body.lockedAt ? String(body.lockedAt) : '';
        if (!mayDeleteJobCard(access, { reviewStatus, status, lockedAt })) {
          return res.json({ ok: false, error: 'Not allowed to delete this job card.' }, 403);
        }
        await databases.deleteDocument(
          access.databaseId,
          access.collectionId,
          access.documentId,
        );
        return res.json({ ok: true });
      }

      await databases.updateDocument(
        access.databaseId,
        access.collectionId,
        access.documentId,
        {},
        buildJobCardPermissionStrings(access.ownerId, access.assigneeIds, access.managerIds),
      );

      return res.json({ ok: true });
    }

    if (action === 'delete-client') {
      const callerId = req.headers['x-appwrite-user-id'];
      if (!callerId) {
        return res.json({ ok: false, error: 'Sign in required.' }, 401);
      }

      const documentId = String(body.documentId ?? '').trim();
      const databaseId = String(body.databaseId ?? '').trim();
      const collectionId = String(body.collectionId ?? '').trim();
      if (!documentId || !databaseId || !collectionId) {
        return res.json({ ok: false, error: 'Missing client delete parameters.' }, 400);
      }

      const users = new Users(adminClient(req));
      const caller = await users.get(callerId);
      if (!canDeleteClientUser(caller)) {
        return res.json({ ok: false, error: 'Not allowed to delete clients.' }, 403);
      }

      const databases = new Databases(adminClient(req));
      await databases.deleteDocument(databaseId, collectionId, documentId);
      return res.json({ ok: true });
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

        if (position) {
          const leadLabels = applyLeadLabel(created.labels ?? [], position);
          if (leadLabels.join('|') !== (created.labels ?? []).join('|')) {
            await users.updateLabels(created.$id, leadLabels);
            created.labels = leadLabels;
          }
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

        let labels = new Set(target.labels ?? []);
        if (position === 'App Dev') labels.add(APP_DEV_LABEL);
        else labels.delete(APP_DEV_LABEL);
        labels = new Set(applyLeadLabel(Array.from(labels), position));
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
