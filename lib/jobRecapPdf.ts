import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatAssigneesDisplay } from './jobAssignees';
import { listComments, type JobComment } from './appwrite/comments';
import {
  downloadAttachmentAsDataUri,
  getAttachmentName,
} from './appwrite/storage';
import { formatEquipmentList } from './jobEquipment';
import {
  formatJobContactDisplay,
  groupJobContactsByVisit,
} from './jobContacts';
import {
  defaultJobRecapExportOptions,
  documentIncluded,
  photoIncluded,
  visitMatchesExport,
  visitRowIncluded,
  type JobRecapExportOptions,
} from './jobRecapExport';
import { formatScheduleLogEntry, formatScheduleWhen } from './jobSchedule';
import { formatVisitOnSiteTimes } from './jobVisitLink';
import {
  collectWorkReportAttachmentIds,
  groupWorkReportByVisit,
  parseWorkReportsFromStorage,
  type WorkReportGroupItem,
} from './jobWorkReports';
import {
  doneVisitCount,
  formatVisitLocationLabel,
  formatVisitWhen,
  JOB_VISIT_STATUS_LABELS,
  nextScheduledVisit,
  normalizeVisitsList,
  scheduledVisitCount,
  sortVisitsTimeline,
  visitStatus,
} from './jobVisits';
import {
  JOB_PRIORITY_LABELS,
  JOB_STATUS_LABELS,
  type JobCard,
  type JobPriority,
  type JobStatus,
} from '../types/jobCard';
import { formatDate, formatDateTime } from '../utils/formatDate';

export interface JobRecapAssets {
  comments: JobComment[];
  photoDataUris: string[];
  documentNames: string[];
  workAttachmentPhotoUris: Record<string, string>;
  workAttachmentDocumentNames: Record<string, string>;
  technicianSignature?: string;
  clientSignature?: string;
}

const BRAND = {
  primary: '#F5BC00',
  primaryDark: '#B8860B',
  black: '#1A1A1A',
  grey600: '#6B7280',
  grey200: '#E5E7EB',
  grey100: '#F3F4F6',
  white: '#FFFFFF',
  success: '#059669',
  info: '#2563EB',
  warning: '#D97706',
};

const STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  in_progress: { bg: '#DBEAFE', text: '#2563EB' },
  pending_review: { bg: '#FEF3C7', text: '#D97706' },
  completed: { bg: '#D1FAE5', text: '#059669' },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function row(label: string, value: string): string {
  if (!value.trim()) return '';
  return `
    <div class="row">
      <div class="row-label">${escapeHtml(label)}</div>
      <div class="row-value">${nl2br(value)}</div>
    </div>`;
}

function section(title: string, body: string, icon?: string): string {
  if (!body.trim()) return '';
  return `
    <section class="section">
      <div class="section-head">
        <span class="section-icon">${icon ?? '◆'}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="section-body">${body}</div>
    </section>`;
}

function badge(text: string, bg: string, color: string): string {
  return `<span class="badge" style="background:${bg};color:${color}">${escapeHtml(text)}</span>`;
}

function statusBadge(status: JobStatus): string {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return badge(JOB_STATUS_LABELS[status], colors.bg, colors.text);
}

function priorityBadge(priority: JobPriority): string {
  const map: Record<JobPriority, { bg: string; text: string }> = {
    low: { bg: '#F3F4F6', text: '#6B7280' },
    normal: { bg: '#DBEAFE', text: '#2563EB' },
    high: { bg: '#FEF3C7', text: '#D97706' },
    urgent: { bg: '#FEE2E2', text: '#DC2626' },
  };
  const colors = map[priority];
  return badge(JOB_PRIORITY_LABELS[priority], colors.bg, colors.text);
}

function listBlock(items: string[], emptyLabel: string): string {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  return `<ol class="list">${items.map((item) => `<li>${nl2br(item)}</li>`).join('')}</ol>`;
}

function workReportItemsHtml(
  items: WorkReportGroupItem[],
  assets: JobRecapAssets,
  emptyLabel: string,
): string {
  const rows = items.filter(
    (item) => item.text.trim() || item.photoIds.length || item.documentIds.length,
  );
  if (!rows.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;

  return rows
    .map((item, index) => {
      const prefix = rows.length > 1 ? `${index + 1}. ` : '';
      const textPart = item.text.trim()
        ? `<div class="work-entry-text">${prefix}${nl2br(item.text)}</div>`
        : rows.length > 1
          ? `<div class="work-entry-text">${prefix}</div>`
          : '';
      const photos = item.photoIds.length
        ? `<div class="work-entry-photos">${item.photoIds
            .map((id) => {
              const uri = assets.workAttachmentPhotoUris[id];
              return uri ? `<div class="work-entry-photo"><img src="${uri}" alt="Work photo"/></div>` : '';
            })
            .join('')}</div>`
        : '';
      const docs = item.documentIds.length
        ? `<ul class="work-entry-docs">${item.documentIds
            .map(
              (id) =>
                `<li>${escapeHtml(assets.workAttachmentDocumentNames[id] ?? 'Document')}</li>`,
            )
            .join('')}</ul>`
        : '';
      return `<div class="work-entry">${textPart}${photos}${docs}</div>`;
    })
    .join('');
}

export async function prepareJobRecapAssets(
  job: JobCard,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
): Promise<JobRecapAssets> {
  const photoIds = (job.photoIds ?? []).filter((id) => photoIncluded(id, options));
  const documentIds = (job.documentIds ?? []).filter((id) => documentIncluded(id, options));

  const [comments, ...documentNames] = await Promise.all([
    options.includeComments ? listComments(job.id) : Promise.resolve([]),
    ...(options.includeDocuments
      ? documentIds.map((id) => getAttachmentName(id))
      : []),
  ]);

  const photoResults = options.includePhotos
    ? await Promise.all(photoIds.map((id) => downloadAttachmentAsDataUri(id)))
    : [];
  const photoDataUris = photoResults.filter((uri): uri is string => Boolean(uri));

  const [technicianSignature, clientSignature] = options.includeSignatures
    ? await Promise.all([
        job.technicianSignatureId ? downloadAttachmentAsDataUri(job.technicianSignatureId) : null,
        job.clientSignatureId ? downloadAttachmentAsDataUri(job.clientSignatureId) : null,
      ])
    : [null, null];

  const workAttachmentPhotoUris: Record<string, string> = {};
  const workAttachmentDocumentNames: Record<string, string> = {};
  if (options.includeWorkReport) {
    const report = job.workReport ?? parseWorkReportsFromStorage(job.workPerformed, job.partsUsed);
    const { photoIds: workPhotoIds, documentIds: workDocumentIds } =
      collectWorkReportAttachmentIds(report);
    const workPhotoResults = await Promise.all(
      workPhotoIds.map(async (id) => {
        const uri = await downloadAttachmentAsDataUri(id);
        return uri ? ([id, uri] as const) : null;
      }),
    );
    for (const row of workPhotoResults) {
      if (row) workAttachmentPhotoUris[row[0]] = row[1];
    }
    const workDocResults = await Promise.all(
      workDocumentIds.map(async (id) => {
        const name = await getAttachmentName(id);
        return name ? ([id, name] as const) : null;
      }),
    );
    for (const row of workDocResults) {
      if (row) workAttachmentDocumentNames[row[0]] = row[1];
    }
  }

  return {
    comments,
    photoDataUris,
    documentNames: documentNames.filter((name): name is string => Boolean(name)),
    workAttachmentPhotoUris,
    workAttachmentDocumentNames,
    technicianSignature: technicianSignature ?? undefined,
    clientSignature: clientSignature ?? undefined,
  };
}

export function buildJobRecapHtml(
  job: JobCard,
  assets: JobRecapAssets,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
): string {
  const visits = sortVisitsTimeline(job.visits ?? []).filter((visit) =>
    visitRowIncluded(visit.id, options),
  );
  const nextVisit = nextScheduledVisit(normalizeVisitsList(job.visits ?? []));
  const equipment =
    job.equipmentItems?.length ? formatEquipmentList(job.equipmentItems) : job.equipment;
  const team = job.assignees?.length ? formatAssigneesDisplay(job.assignees) : job.technicianName;
  const report =
    job.workReport ?? parseWorkReportsFromStorage(job.workPerformed, job.partsUsed);
  const workGroups = options.includeWorkReport
    ? groupWorkReportByVisit(report, normalizeVisitsList(job.visits ?? [])).filter((group) =>
        visitMatchesExport(group.visitId, options),
      )
    : [];
  const contactGroups = options.includeContacts
    ? groupJobContactsByVisit(job.jobContacts ?? [], normalizeVisitsList(job.visits ?? [])).filter(
        (group) => visitMatchesExport(group.visitId, options),
      )
    : [];
  const legacyContact =
    !job.jobContacts?.length && (job.contactName || job.contactPhone)
      ? [job.contactName, job.contactPhone].filter(Boolean).join(' · ')
      : '';

  const summaryCards = [
    { label: 'Created', value: formatDateTime(job.createdAt) },
    ...(options.includeVisits
      ? [
          {
            label: 'Next visit',
            value: nextVisit
              ? formatScheduleWhen(nextVisit.date, nextVisit.time)
              : formatScheduleWhen(job.scheduledDate, job.scheduledTime),
          },
          {
            label: 'Visits',
            value: `${doneVisitCount(job.visits)} done · ${scheduledVisitCount(job.visits)} planned`,
          },
        ]
      : []),
  ];

  const visitRows = options.includeVisits
    ? visits.length
      ? visits
          .map((visit, index) => {
            const status = visitStatus(visit);
            const statusColors =
              status === 'done'
                ? { bg: '#D1FAE5', text: BRAND.success }
                : status === 'rescheduled'
                  ? { bg: '#F3F4F6', text: BRAND.grey600 }
                  : { bg: '#DBEAFE', text: BRAND.info };
            const onSite = formatVisitOnSiteTimes(visit);
            const locationLabel = formatVisitLocationLabel(visit, job.siteAddress);
            return `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${escapeHtml(visit.label || `Visit ${index + 1}`)}</strong></td>
              <td>${escapeHtml(formatVisitWhen(visit))}</td>
              <td>${escapeHtml(locationLabel)}</td>
              <td>${escapeHtml(onSite || '—')}</td>
              <td>${badge(JOB_VISIT_STATUS_LABELS[status], statusColors.bg, statusColors.text)}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="6" class="muted">No visits recorded.</td></tr>`
    : '';

  const historyRows =
    options.includeScheduleHistory && (job.scheduleLog ?? []).length
    ? [...(job.scheduleLog ?? [])]
        .reverse()
        .map(
          (entry) => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(formatScheduleLogEntry(entry))}</div>
              <div class="timeline-meta">${escapeHtml(entry.userName || 'User')} · ${escapeHtml(formatDate(entry.at))}</div>
              ${entry.note && entry.action !== 'done' ? `<div class="timeline-note">${nl2br(entry.note)}</div>` : ''}
            </div>
          </div>`,
        )
        .join('')
    : '';

  const commentRows = assets.comments.length
    ? assets.comments
        .map(
          (comment) => `
          <div class="comment">
            <div class="comment-head">
              <strong>${escapeHtml(comment.authorName)}</strong>
              <span>${escapeHtml(formatDateTime(comment.createdAt))}</span>
            </div>
            <div class="comment-body">${nl2br(comment.body)}</div>
          </div>`,
        )
        .join('')
    : '';

  const photoGrid = assets.photoDataUris.length
    ? `<div class="photo-grid">${assets.photoDataUris
        .map((uri) => `<div class="photo-cell"><img src="${uri}" alt="Site photo"/></div>`)
        .join('')}</div>`
    : '';

  const docList = assets.documentNames.length
    ? `<ul class="doc-list">${assets.documentNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
    : '';

  const signatures = `
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-label">Technician</div>
        ${
          assets.technicianSignature
            ? `<img class="signature-img" src="${assets.technicianSignature}" alt="Technician signature"/>`
            : '<div class="signature-empty">Not signed</div>'
        }
        <div class="signature-name">${escapeHtml(job.technicianName)}</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Client</div>
        ${
          assets.clientSignature
            ? `<img class="signature-img" src="${assets.clientSignature}" alt="Client signature"/>`
            : '<div class="signature-empty">Not signed</div>'
        }
        <div class="signature-name">${escapeHtml(job.clientSignatureName || '—')}</div>
      </div>
    </div>`;

  const clientSection = options.includeClient
    ? [row('Client', job.clientName), row('Site address', job.siteAddress)].join('')
    : '';

  const contactsSection = options.includeContacts
    ? contactGroups.length
      ? contactGroups
          .map(
            (group) => `
        <div class="work-visit-group">
          <div class="work-visit-title">${escapeHtml(group.visitLabel)}</div>
          ${group.contacts
            .map((contact) => `<p>${nl2br(formatJobContactDisplay(contact, []))}</p>`)
            .join('')}
        </div>`,
          )
          .join('')
      : legacyContact
        ? row('Contacts', legacyContact)
        : ''
    : '';

  const missionSection = options.includeMission
    ? [
        row('Mission types', job.missionType),
        row('Equipment / systems', equipment),
        row('Team', team),
        row('Started', job.startedAt ? formatDateTime(job.startedAt) : ''),
        row('Finished', job.finishedAt ? formatDateTime(job.finishedAt) : ''),
        row(
          'Initial visit',
          formatScheduleWhen(
            job.initialScheduledDate || job.scheduledDate,
            job.initialScheduledTime ?? job.scheduledTime,
          ),
        ),
      ].join('')
    : '';

  const workSection = workGroups.length
    ? workGroups
        .map(
          (group) => `
        <div class="work-visit-group">
          <div class="work-visit-title">${escapeHtml(group.visitLabel)}</div>
          <div class="split">
            <div class="split-col">
              <h3>Work performed</h3>
              ${workReportItemsHtml(group.workItems, assets, 'No work recorded.')}
            </div>
            <div class="split-col">
              <h3>Parts used</h3>
              ${workReportItemsHtml(group.partItems, assets, 'No parts listed.')}
            </div>
          </div>
        </div>`,
        )
        .join('')
    : `<div class="split">
        <div class="split-col"><h3>Work performed</h3><p class="muted">No work recorded.</p></div>
        <div class="split-col"><h3>Parts used</h3><p class="muted">No parts listed.</p></div>
      </div>`;
  const workSectionWithNotes = options.includeWorkReport
    ? `${workSection}${row('Additional notes', job.notes)}`
    : '';

  const generatedAt = formatDateTime(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Job recap · ${escapeHtml(job.reference)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: ${BRAND.black};
      font-size: 10.5pt;
      line-height: 1.45;
      margin: 0;
      background: ${BRAND.white};
    }
    .header {
      background: linear-gradient(135deg, ${BRAND.primary} 0%, #FFE082 100%);
      border-radius: 14px;
      padding: 22px 24px;
      margin-bottom: 18px;
      border: 1px solid #E6AD00;
    }
    .brand-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .brand { font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-sub { font-size: 9pt; color: #5C4A00; margin-top: 4px; font-weight: 600; }
    .report-tag {
      background: rgba(255,255,255,0.75);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5C4A00;
      white-space: nowrap;
    }
    .hero {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ref { font-size: 18pt; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
    .client-name { font-size: 12pt; color: #3D3200; margin-top: 4px; font-weight: 600; }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .summary-card {
      background: ${BRAND.grey100};
      border: 1px solid ${BRAND.grey200};
      border-radius: 12px;
      padding: 12px 14px;
    }
    .summary-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${BRAND.grey600};
      font-weight: 700;
      margin-bottom: 4px;
    }
    .summary-value { font-size: 10pt; font-weight: 700; color: ${BRAND.black}; }
    .section {
      margin-bottom: 16px;
      break-inside: avoid-page;
    }
    .section-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${BRAND.primary};
    }
    .section-icon { color: ${BRAND.primaryDark}; font-size: 10pt; }
    .section-head h2 {
      margin: 0;
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .section-body {
      background: ${BRAND.white};
      border: 1px solid ${BRAND.grey200};
      border-radius: 12px;
      padding: 14px 16px;
    }
    .row {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 10px;
      padding: 7px 0;
      border-bottom: 1px solid ${BRAND.grey100};
    }
    .row:last-child { border-bottom: none; }
    .row-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${BRAND.grey600};
      font-weight: 700;
    }
    .row-value { font-size: 10pt; color: ${BRAND.black}; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    th {
      text-align: left;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${BRAND.grey600};
      padding: 8px 10px;
      background: ${BRAND.grey100};
      border-bottom: 1px solid ${BRAND.grey200};
    }
    td {
      padding: 10px;
      border-bottom: 1px solid ${BRAND.grey100};
      vertical-align: top;
    }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .split-col h3 {
      margin: 0 0 8px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${BRAND.grey600};
    }
    .list { margin: 0; padding-left: 18px; }
    .list li { margin-bottom: 6px; }
    .muted { color: ${BRAND.grey600}; font-style: italic; margin: 0; }
    .timeline-item {
      display: grid;
      grid-template-columns: 12px 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .timeline-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${BRAND.primary};
      margin-top: 4px;
    }
    .timeline-title { font-weight: 700; font-size: 9.5pt; }
    .timeline-meta { font-size: 8.5pt; color: ${BRAND.grey600}; margin-top: 2px; }
    .timeline-note { font-size: 9pt; margin-top: 4px; color: #374151; }
    .comment {
      border-left: 3px solid ${BRAND.primary};
      padding: 8px 0 8px 12px;
      margin-bottom: 10px;
    }
    .comment-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 8.5pt;
      color: ${BRAND.grey600};
      margin-bottom: 4px;
    }
    .comment-body { font-size: 9.5pt; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .signature-box {
      border: 1px dashed ${BRAND.grey200};
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      min-height: 120px;
    }
    .signature-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${BRAND.grey600};
      font-weight: 700;
      margin-bottom: 8px;
    }
    .signature-img {
      max-width: 100%;
      max-height: 80px;
      object-fit: contain;
    }
    .signature-empty {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${BRAND.grey600};
      font-style: italic;
      font-size: 9pt;
    }
    .signature-name { margin-top: 8px; font-size: 9pt; font-weight: 700; }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .photo-cell {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid ${BRAND.grey200};
      aspect-ratio: 1;
      background: ${BRAND.grey100};
    }
    .photo-cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .doc-list { margin: 0; padding-left: 18px; }
    .doc-list li { margin-bottom: 4px; font-size: 9.5pt; }
    .work-visit-group {
      border: 1px solid ${BRAND.grey200};
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: ${BRAND.grey100};
    }
    .work-visit-title {
      font-size: 9pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${BRAND.info};
      margin-bottom: 10px;
    }
    .work-entry {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed ${BRAND.grey200};
    }
    .work-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .work-entry-text { font-size: 9.5pt; margin-bottom: 6px; }
    .work-entry-photos {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 6px 0;
    }
    .work-entry-photo {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${BRAND.grey200};
      background: ${BRAND.white};
    }
    .work-entry-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .work-entry-docs {
      margin: 4px 0 0;
      padding-left: 16px;
      font-size: 9pt;
    }
    .work-entry-docs li { margin-bottom: 2px; }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid ${BRAND.grey200};
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 8pt;
      color: ${BRAND.grey600};
    }
    .footer strong { color: ${BRAND.black}; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-row">
      <div>
        <h1 class="brand">MyBaladi</h1>
        <div class="brand-sub">Heavy equipment & field services · Job recap report</div>
      </div>
      <div class="report-tag">Official recap</div>
    </div>
    <div class="hero">
      <div>
        <p class="ref">${escapeHtml(job.reference)}</p>
        <div class="client-name">${escapeHtml(job.clientName)}</div>
      </div>
      <div class="badges">${statusBadge(job.status)} ${priorityBadge(job.priority)}${
        job.lockedAt ? badge('Signed & locked', '#D1FAE5', BRAND.success) : ''
      }</div>
    </div>
  </div>

  <div class="summary">
    ${summaryCards
      .map(
        (card) => `
      <div class="summary-card">
        <div class="summary-label">${escapeHtml(card.label)}</div>
        <div class="summary-value">${escapeHtml(card.value)}</div>
      </div>`,
      )
      .join('')}
  </div>

  ${section('Client & site', clientSection, '📍')}
  ${contactsSection ? section('Site contacts', contactsSection, '👤') : ''}
  ${section('Mission & team', missionSection, '🔧')}
  ${
    options.includeVisits
      ? section(
          'Visit timeline',
          `<table>
      <thead><tr><th>#</th><th>Label</th><th>When</th><th>Location</th><th>On site</th><th>Status</th></tr></thead>
      <tbody>${visitRows}</tbody>
    </table>`,
          '📅',
        )
      : ''
  }
  ${options.includeWorkReport ? section('Work report', workSectionWithNotes, '📋') : ''}
  ${historyRows ? section('Schedule history', `<div class="timeline">${historyRows}</div>`, '🕐') : ''}
  ${commentRows ? section('Comments', commentRows, '💬') : ''}
  ${options.includeSignatures ? section('Sign-off', signatures, '✍️') : ''}
  ${photoGrid ? section('Site photos', photoGrid, '📷') : ''}
  ${docList ? section('Documents', docList, '📎') : ''}

  <div class="footer">
    <span>Generated <strong>${escapeHtml(generatedAt)}</strong></span>
    <span>MyBaladi · ${escapeHtml(job.reference)}</span>
  </div>
</body>
</html>`;
}

export async function exportJobRecapPdf(
  job: JobCard,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
): Promise<string> {
  const assets = await prepareJobRecapAssets(job, options);
  const html = buildJobRecapHtml(job, assets, options);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 595,
    height: 842,
  });
  return uri;
}

export async function shareJobRecapPdf(
  job: JobCard,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
): Promise<void> {
  const uri = await exportJobRecapPdf(job, options);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Share recap · ${job.reference}`,
  });
}
