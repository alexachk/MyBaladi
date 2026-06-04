/** Mirrors `lib/jobPeople.ts` + `lib/jobWorkReports.ts` for admin seed scripts. */

const ASSIGNEES_MAX = 2000;

function compactVisit(visit) {
  const row = {
    id: visit.id,
    date: visit.date,
    time: visit.time ?? null,
    status: visit.status ?? 'scheduled',
  };
  if (visit.label) row.label = String(visit.label).slice(0, 48);
  if (visit.location) row.location = String(visit.location).slice(0, 160);
  if (visit.arrivalTime) row.arrivalTime = visit.arrivalTime;
  if (visit.departureTime) row.departureTime = visit.departureTime;
  if (visit.completedAt) row.completedAt = visit.completedAt;
  if (visit.latitude != null) row.latitude = visit.latitude;
  if (visit.longitude != null) row.longitude = visit.longitude;
  return row;
}

function buildAssigneesPayload(blob, options = {}) {
  const { compactContacts = false, stripGeo = false, dropLog = false } = options;
  const team = blob.team ?? [];
  const contacts = (blob.contacts ?? []).map((c) => ({
    ...c,
    firstName: (c.firstName ?? '').slice(0, 64),
    lastName: (c.lastName ?? '').slice(0, 64),
  }));
  const missions = blob.missions ?? [];
  const equipment = blob.equipment ?? [];
  const missionScopes = blob.missionScopes ?? [];
  const missionNotes = blob.missionNotes ?? [];

  const hasWrapper =
    contacts.length > 0 ||
    missions.length > 1 ||
    equipment.length > 0 ||
    missionScopes.length > 0 ||
    missionNotes.length > 0 ||
    blob.schedule;

  if (!hasWrapper) {
    return JSON.stringify(team);
  }

  let schedule = blob.schedule;
  if (schedule) {
    schedule = {
      initialDate: schedule.initialDate,
      initialTime: schedule.initialTime ?? null,
      log: dropLog ? [] : (schedule.log ?? []).slice(-8),
      visits: (schedule.visits ?? []).map((v) => {
        const c = compactVisit(v);
        if (stripGeo) {
          delete c.latitude;
          delete c.longitude;
        }
        return c;
      }),
    };
  }

  const payload = { team, contacts: compactContacts ? contacts : blob.contacts ?? [], missions };
  if (equipment.length) payload.equipment = equipment;
  if (missionScopes.length) payload.missionScopes = missionScopes;
  if (missionNotes.length) payload.missionNotes = missionNotes;
  if (schedule) payload.schedule = schedule;
  return JSON.stringify(payload);
}

export function serializeAssigneesForWrite(blob) {
  const attempts = [
    {},
    { compactContacts: true },
    { compactContacts: true, stripGeo: true },
    { compactContacts: true, stripGeo: true, dropLog: true },
  ];
  for (const options of attempts) {
    const json = buildAssigneesPayload(blob, options);
    if (json.length <= ASSIGNEES_MAX) return json;
  }
  const json = buildAssigneesPayload(blob, {
    compactContacts: true,
    stripGeo: true,
    dropLog: true,
  });
  if (json.length > ASSIGNEES_MAX) {
    throw new Error(`assignees blob too large (${json.length} > ${ASSIGNEES_MAX})`);
  }
  return json;
}

export function serializeWorkReport(report) {
  const work = (report.workItems ?? []).filter((i) => i?.text?.trim());
  const parts = (report.partItems ?? []).filter((i) => i?.text?.trim());
  const notes = (report.noteItems ?? []).filter((i) => i?.text?.trim());
  if (!work.length && !parts.length && !notes.length) {
    return { workPerformed: '', partsUsed: '' };
  }
  if (work.length === 1 && !parts.length && !notes.length && !work[0].visitId) {
    return { workPerformed: work[0].text, partsUsed: '' };
  }
  const payload = { v: 3, work, parts };
  if (notes.length) payload.notes = notes;
  const partsLines = parts.map((p) => p.text).join('\n');
  return {
    workPerformed: JSON.stringify(payload),
    partsUsed: partsLines.slice(0, 2000),
  };
}
