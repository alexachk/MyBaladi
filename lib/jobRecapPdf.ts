import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image } from 'react-native';
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
  RECAP_DOCUMENT_TYPE_META,
  visitMatchesExport,
  visitRowIncluded,
  type RecapDocumentType,
  type JobRecapExportOptions,
} from './jobRecapExport';
import { buildSignOffPdfBlock, buildSignOffRecapHtml } from './jobSignatures';
import { formatScheduleLogEntry, formatScheduleWhen, scheduleLogForDisplay } from './jobSchedule';
import { formatVisitOnSiteTimes } from './jobVisitLink';
import { formatVisitNotesList, missionNotesFromJob } from './jobVisitNotes';
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
import {
  buildRecapSiteMapMarkup,
  buildRecapSiteMapMarkupSync,
} from './jobRecapMap';
import {
  buildRecapValidationDetails,
  recapValidationSectionVisible,
} from './jobReview';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { renderRecapPdfOnServer } from './appwrite/jobRecapPdfFn';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  RECAP_PAGE_BOTTOM_MARGIN_MM,
  RECAP_PAGE_TOP_MARGIN_MM,
  finalizeRecapPdf,
  mmToPt,
  recapLogoBase64FromDataUri,
  recapRasterWidthPx,
  type RecapPdfStampMeta,
} from './jobRecapPdfStamp';
import { RECAP_FONT_FACE_CSS, RECAP_FONT_FAMILY } from './jobRecapPdfFonts';
import {
  RECAP_BORDER_PT,
  RECAP_BRAND,
  RECAP_MAP_DISPLAY_MAX_HEIGHT_MM,
  RECAP_MARGIN_MM,
  RECAP_TYPO,
} from './jobRecapPdfTheme';

export interface JobRecapAssets {
  logoDataUri: string;
  /** Rectangular map banner HTML (raster, tile grid, or SVG). */
  siteMapMarkup: string;
  siteMapCoords: { latitude: number; longitude: number } | null;
  comments: JobComment[];
  photoDataUris: string[];
  documentNames: string[];
  workAttachmentPhotoUris: Record<string, string>;
  workAttachmentDocumentNames: Record<string, string>;
  technicianSignatureDataUri: string | null;
  clientSignatureDataUri: string | null;
}

const BALADI_LOGO = require('../assets/baladi-freres-sal.png');

const COMPANY = {
  name: 'Baladi Frères SAL',
  tagline: 'Heavy equipment & field services',
  app: 'MyBaladi',
};

export interface JobRecapPrintMeta {
  generatedByName?: string;
  /** expo-print supplies margins — keep @page margin at 0 to avoid double inset. */
  nativePrintMargins?: boolean;
}

function sanitizeRefForFileName(reference: string): string {
  const cleaned = (reference || 'NO-REF')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'NO-REF';
}

/** Local / shared PDF name: Baladi_{ref}_{Draft|Report}_{YYYY-MM-DD_HHmm}.pdf */
export function buildRecapPdfFileName(
  job: Pick<JobCard, 'reference'>,
  documentType: RecapDocumentType,
  generatedAt: Date = new Date(),
): string {
  const ref = sanitizeRefForFileName(job.reference);
  const kind = documentType === 'draft' ? 'Draft' : 'Report';
  const y = generatedAt.getFullYear();
  const mo = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const d = String(generatedAt.getDate()).padStart(2, '0');
  const h = String(generatedAt.getHours()).padStart(2, '0');
  const mi = String(generatedAt.getMinutes()).padStart(2, '0');
  return `Baladi_${ref}_${kind}_${y}-${mo}-${d}_${h}${mi}.pdf`;
}

function assignRecapPdfFileName(sourceUri: string, fileName: string): string {
  const source = new File(sourceUri);
  if (!source.exists) return sourceUri;
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete();
  if (source.name === fileName) return source.uri;
  try {
    source.rename(fileName);
    return source.uri;
  } catch {
    source.copy(dest);
    try {
      source.delete();
    } catch {
      // best-effort
    }
    return dest.uri;
  }
}

let cachedLogoDataUri: string | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? chars[triplet & 63] : '=';
  }
  return result;
}

async function loadBaladiLogoDataUri(): Promise<string> {
  const source = Image.resolveAssetSource(BALADI_LOGO);
  const response = await fetch(source.uri);
  if (!response.ok) throw new Error('Unable to load company logo for PDF.');
  const buffer = await response.arrayBuffer();
  return `data:image/png;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

export async function getBaladiLogoDataUri(): Promise<string> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  cachedLogoDataUri = await loadBaladiLogoDataUri();
  return cachedLogoDataUri;
}

const STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  planned: { bg: '#FFF4CC', text: '#92400E' },
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

function formatCoordPair(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
}

function visitWithCoordinates(
  visits: ReturnType<typeof sortVisitsTimeline>,
): { latitude: number; longitude: number } | null {
  const pinned = visits.find(
    (visit) => typeof visit.latitude === 'number' && typeof visit.longitude === 'number',
  );
  if (!pinned) return null;
  return { latitude: pinned.latitude!, longitude: pinned.longitude! };
}

function resolveSiteMapPin(
  job: JobCard,
): { latitude: number; longitude: number; label: string } | null {
  const visits = sortVisitsTimeline(job.visits ?? []);
  const coords = visitWithCoordinates(visits);
  if (coords) {
    const pinned = visits.find(
      (visit) => typeof visit.latitude === 'number' && typeof visit.longitude === 'number',
    )!;
    const label =
      job.siteAddress?.trim() || formatVisitLocationLabel(pinned, job.siteAddress) || job.clientName;
    return { ...coords, label };
  }
  return null;
}

async function geocodeSiteAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const query = address.trim();
  if (!query) return null;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'MyBaladi/1.0 (recap-pdf)' } },
    );
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = results[0];
    if (!hit) return null;
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

async function resolveSiteMapPinForRecap(
  job: JobCard,
): Promise<{ latitude: number; longitude: number; label: string } | null> {
  const fromVisit = resolveSiteMapPin(job);
  if (fromVisit) return fromVisit;
  const address = job.siteAddress?.trim();
  if (!address) return null;
  const coords = await geocodeSiteAddress(address);
  if (!coords) return null;
  return { ...coords, label: address };
}

function siteLocationHtml(
  address: string,
  assets: JobRecapAssets,
): string {
  if (!address.trim() && !assets.siteMapCoords) return '';
  const coords = assets.siteMapCoords
    ? formatCoordPair(assets.siteMapCoords.latitude, assets.siteMapCoords.longitude)
    : '';
  const mapBlock =
    assets.siteMapMarkup ||
    (assets.siteMapCoords
      ? buildRecapSiteMapMarkupSync(
          assets.siteMapCoords.latitude,
          assets.siteMapCoords.longitude,
        )
      : '');
  const coordsBlock = coords
    ? `<div class="site-coords"><strong>GPS</strong> ${escapeHtml(coords)}</div>`
    : '';
  return `
    <div class="site-location">
      ${address.trim() ? `<div class="site-address">${nl2br(address)}</div>` : ''}
      ${coordsBlock}
      ${mapBlock}
    </div>`;
}

function visitLocationCell(
  visit: { location?: string; latitude?: number; longitude?: number; label?: string },
  jobSiteAddress: string,
): string {
  const label = formatVisitLocationLabel(visit, jobSiteAddress);
  const coords =
    typeof visit.latitude === 'number' && typeof visit.longitude === 'number'
      ? formatCoordPair(visit.latitude, visit.longitude)
      : '';
  return coords
    ? `${escapeHtml(label)}<div class="visit-coords">${escapeHtml(coords)}</div>`
    : escapeHtml(label);
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

const VALIDATION_TONE_COLORS: Record<
  ReturnType<typeof buildRecapValidationDetails>['tone'],
  { bg: string; text: string }
> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
  bypass: { bg: '#FEE2E2', text: '#DC2626' },
  none: { bg: '#F3F4F6', text: '#6B7280' },
};

function validationStatusBadge(tone: keyof typeof VALIDATION_TONE_COLORS, label: string): string {
  const colors = VALIDATION_TONE_COLORS[tone];
  return badge(label, colors.bg, colors.text);
}

function buildRecapValidationSectionHtml(
  job: JobCard,
  documentType: RecapDocumentType,
): string {
  if (!recapValidationSectionVisible(job, documentType)) return '';
  const details = buildRecapValidationDetails(job);
  const statusPill = validationStatusBadge(details.tone, details.statusLabel);
  const rows = details.rows.map((r) => row(r.label, r.value)).join('');
  return section(
    'Supervisor validation',
    `<div class="validation-block">${statusPill}${rows ? `<div class="validation-rows">${rows}</div>` : ''}</div>`,
    '✓',
  );
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

  const sitePin = options.includeClient ? await resolveSiteMapPinForRecap(job) : null;

  const [logoDataUri, comments, siteMapMarkup, techSigUri, clientSigUri, ...documentNames] =
    await Promise.all([
      getBaladiLogoDataUri(),
      options.includeComments ? listComments(job.id) : Promise.resolve([]),
      sitePin
        ? buildRecapSiteMapMarkup(sitePin.latitude, sitePin.longitude)
        : Promise.resolve(''),
      job.technicianSignatureId
        ? downloadAttachmentAsDataUri(job.technicianSignatureId)
        : Promise.resolve(null),
      job.clientSignatureId
        ? downloadAttachmentAsDataUri(job.clientSignatureId)
        : Promise.resolve(null),
      ...(options.includeDocuments
        ? documentIds.map((id) => getAttachmentName(id))
        : []),
    ]);

  const photoResults = options.includePhotos
    ? await Promise.all(photoIds.map((id) => downloadAttachmentAsDataUri(id)))
    : [];
  const photoDataUris = photoResults.filter((uri): uri is string => Boolean(uri));

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
    logoDataUri,
    siteMapMarkup: sitePin
      ? siteMapMarkup || buildRecapSiteMapMarkupSync(sitePin.latitude, sitePin.longitude)
      : '',
    siteMapCoords: sitePin
      ? { latitude: sitePin.latitude, longitude: sitePin.longitude }
      : null,
    comments,
    photoDataUris,
    documentNames: documentNames.filter((name): name is string => Boolean(name)),
    workAttachmentPhotoUris,
    workAttachmentDocumentNames,
    technicianSignatureDataUri: techSigUri,
    clientSignatureDataUri: clientSigUri,
  };
}

export function buildJobRecapHtml(
  job: JobCard,
  assets: JobRecapAssets,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
  meta: JobRecapPrintMeta = {},
): string {
  const generatedByName = meta.generatedByName?.trim() || '—';
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
    ? groupWorkReportByVisit(report, normalizeVisitsList(job.visits ?? [])).filter(
        (group) =>
          visitMatchesExport(group.visitId, options) &&
          (group.workItems.length ||
            group.partItems.length ||
            group.noteItems.length),
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

  const validationDetails = buildRecapValidationDetails(job);
  const showValidation = recapValidationSectionVisible(job, options.documentType);

  const summaryCards = [
    { label: 'Created', value: formatDateTime(job.createdAt) },
    ...(showValidation
      ? [{ label: 'Validation', value: validationDetails.statusLabel }]
      : []),
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
                ? { bg: '#D1FAE5', text: RECAP_BRAND.success }
                : status === 'rescheduled'
                  ? { bg: '#F3F4F6', text: RECAP_BRAND.grey600 }
                  : { bg: '#DBEAFE', text: RECAP_BRAND.info };
            const onSite = formatVisitOnSiteTimes(visit);
            const whenCell = onSite
              ? `${escapeHtml(formatVisitWhen(visit))}<div class="cell-sub">${escapeHtml(onSite)}</div>`
              : escapeHtml(formatVisitWhen(visit));
            return `
            <tr>
              <td class="col-num">${index + 1}</td>
              <td><strong>${escapeHtml(visit.label || `Visit ${index + 1}`)}</strong></td>
              <td>${whenCell}</td>
              <td class="col-loc">${visitLocationCell(visit, job.siteAddress)}</td>
              <td class="col-status">${badge(JOB_VISIT_STATUS_LABELS[status], statusColors.bg, statusColors.text)}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="5" class="muted">No visits recorded.</td></tr>`
    : '';

  const displayScheduleLog = scheduleLogForDisplay(job.scheduleLog);
  const historyRows =
    options.includeScheduleHistory && displayScheduleLog.length
    ? [...displayScheduleLog]
        .reverse()
        .map(
          (entry) => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(formatScheduleLogEntry(entry, visits))}</div>
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

  const clientSection = options.includeClient
    ? [
        row('Client', job.clientName),
        options.includeClient &&
        (job.siteAddress.trim() || assets.siteMapCoords || assets.siteMapMarkup)
          ? `<div class="row">
      <div class="row-label">Site &amp; map</div>
      <div class="row-value">${siteLocationHtml(job.siteAddress, assets)}</div>
    </div>`
          : '',
      ].join('')
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

  const missionNotesText = formatVisitNotesList(missionNotesFromJob(job), normalizeVisitsList(job.visits ?? []));
  const missionSection = options.includeMission
    ? [
        row('Mission types', job.missionType),
        row('Equipment / systems', equipment),
        row('Team', team),
        row('Mission notes', missionNotesText),
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
          ${
            group.noteItems.length
              ? `<h3>Work notes</h3>${workReportItemsHtml(group.noteItems, assets, '')}`
              : ''
          }
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

  const signOffBlock = buildSignOffPdfBlock(job, {
    tech: assets.technicianSignatureDataUri,
    client: assets.clientSignatureDataUri,
  });
  const signaturesSection = signOffBlock ? buildSignOffRecapHtml(signOffBlock) : '';

  const now = new Date();
  const generatedAt = formatDateTime(now.toISOString());
  const generatedDate = formatDate(now.toISOString());
  const typeMeta = RECAP_DOCUMENT_TYPE_META[options.documentType];
  const isDraft = options.documentType === 'draft';
  const docTitle = isDraft ? 'Intervention report — Draft' : 'Intervention report';
  const m = RECAP_MARGIN_MM;
  const pageMarginCss = meta.nativePrintMargins
    ? '0'
    : `${RECAP_PAGE_TOP_MARGIN_MM}mm ${m.right}mm ${RECAP_PAGE_BOTTOM_MARGIN_MM}mm ${m.left}mm`;
  const mapMaxH = RECAP_MAP_DISPLAY_MAX_HEIGHT_MM;
  const border = `${RECAP_BORDER_PT}pt`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=${A4_WIDTH_PT}, initial-scale=1"/>
  <title>${escapeHtml(COMPANY.name)} · ${escapeHtml(job.reference)}</title>
  <style>
    ${RECAP_FONT_FACE_CSS}
    @page {
      size: A4;
      margin: ${pageMarginCss};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
    }
    body {
      width: auto;
      max-width: none;
      font-family: ${RECAP_FONT_FAMILY};
      color: ${RECAP_BRAND.ink};
      font-size: ${RECAP_TYPO.body};
      line-height: ${RECAP_TYPO.lineBody};
      font-weight: 400;
      background: ${RECAP_BRAND.white};
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .site-map {
      image-rendering: -webkit-optimize-contrast;
    }
    .recap-page {
      box-sizing: border-box;
    }
    .content {
      overflow-wrap: break-word;
      word-break: normal;
    }
    table.data-table {
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
    }
    .data-table th,
    .data-table td {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    .cell-sub {
      font-size: 7.5pt;
      color: ${RECAP_BRAND.grey600};
      margin-top: 3px;
      line-height: 1.35;
    }
    .site-location { display: flex; flex-direction: column; gap: 6px; }
    .site-address { font-size: ${RECAP_TYPO.body}; line-height: 1.45; }
    .site-coords {
      font-size: ${RECAP_TYPO.small};
      color: ${RECAP_BRAND.grey600};
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .site-map-wrap {
      border-radius: 8px;
      overflow: hidden;
      border: ${border} solid ${RECAP_BRAND.grey200};
      max-width: 100%;
      max-height: ${mapMaxH}mm;
      background: ${RECAP_BRAND.grey100};
      position: relative;
    }
    .site-map {
      display: block;
      width: 100%;
      max-width: 100%;
      max-height: ${mapMaxH}mm;
      height: auto;
      aspect-ratio: 8 / 3;
      object-fit: cover;
      image-rendering: -webkit-optimize-contrast;
    }
    .site-map-tiles .site-map-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      width: 100%;
      max-height: ${mapMaxH}mm;
      aspect-ratio: 8 / 3;
    }
    .site-map-tiles .site-map-grid img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .site-map-pin {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 16px;
      height: 16px;
      margin: -18px 0 0 -8px;
      background: ${RECAP_BRAND.primary};
      border: 2px solid ${RECAP_BRAND.ink};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      pointer-events: none;
      z-index: 2;
    }
    .photo-cell img,
    .work-entry-photo img {
      image-rendering: -webkit-optimize-contrast;
    }
    .site-coords strong {
      color: ${RECAP_BRAND.ink};
      margin-right: 4px;
    }
    .visit-coords {
      font-size: 7.5pt;
      color: ${RECAP_BRAND.grey600};
      margin-top: 3px;
      font-variant-numeric: tabular-nums;
    }

    .title-band {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: ${border} solid ${RECAP_BRAND.grey200};
    }
    .doc-kicker {
      font-size: ${RECAP_TYPO.tiny};
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${RECAP_BRAND.primaryDark};
    }
    .doc-title {
      font-size: ${RECAP_TYPO.h1};
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.15;
      margin: 3px 0 4px;
      color: ${RECAP_BRAND.black};
    }
    .doc-client { font-size: 10pt; color: ${RECAP_BRAND.grey700}; font-weight: 600; line-height: 1.3; }
    .doc-meta-line {
      font-size: ${RECAP_TYPO.tiny};
      color: ${RECAP_BRAND.grey600};
      margin-top: 4px;
      line-height: 1.4;
    }
    .badges { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 5px; }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 12px;
      width: 100%;
    }
    .summary-card {
      background: ${RECAP_BRAND.grey50};
      border: ${border} solid ${RECAP_BRAND.grey200};
      border-radius: 6px;
      padding: 7px 9px;
    }
    .summary-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${RECAP_BRAND.grey600};
      font-weight: 700;
      margin-bottom: 3px;
    }
    .summary-value { font-size: ${RECAP_TYPO.small}; font-weight: 700; color: ${RECAP_BRAND.ink}; }
    .section {
      margin-bottom: 10px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: ${border} solid ${RECAP_BRAND.grey200};
    }
    .section-icon { color: ${RECAP_BRAND.primaryDark}; font-size: 9pt; }
    .section-head h2 {
      margin: 0;
      font-size: ${RECAP_TYPO.h2};
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${RECAP_BRAND.ink};
    }
    .section-body {
      background: ${RECAP_BRAND.white};
      border: ${border} solid ${RECAP_BRAND.grey200};
      border-radius: 6px;
      padding: 8px 10px;
    }
    .row {
      display: grid;
      grid-template-columns: 108px 1fr;
      gap: 8px;
      padding: 4px 0;
      border-bottom: ${border} solid ${RECAP_BRAND.grey100};
    }
    .row:last-child { border-bottom: none; }
    .row-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${RECAP_BRAND.grey600};
      font-weight: 700;
    }
    .row-value { font-size: ${RECAP_TYPO.body}; color: ${RECAP_BRAND.ink}; line-height: 1.45; }
    table.data-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      font-size: ${RECAP_TYPO.small};
      table-layout: fixed;
    }
    table.data-table th:nth-child(1),
    table.data-table td.col-num { width: 5%; }
    table.data-table th:nth-child(2) { width: 14%; }
    table.data-table th:nth-child(3) { width: 22%; }
    table.data-table th:nth-child(4),
    table.data-table td.col-loc { width: 39%; }
    table.data-table th:nth-child(5),
    table.data-table td.col-status { width: 20%; white-space: nowrap; }
    table.data-table tr { break-inside: avoid; page-break-inside: avoid; }
    th {
      text-align: left;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${RECAP_BRAND.grey600};
      padding: 5px 7px;
      background: ${RECAP_BRAND.grey50};
      border-bottom: ${border} solid ${RECAP_BRAND.grey200};
    }
    td {
      padding: 5px 7px;
      border-bottom: ${border} solid ${RECAP_BRAND.grey100};
      vertical-align: top;
    }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .split-col h3 {
      margin: 0 0 8px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${RECAP_BRAND.grey600};
    }
    .list { margin: 0; padding-left: 18px; }
    .list li { margin-bottom: 6px; }
    .muted { color: ${RECAP_BRAND.grey600}; font-style: italic; margin: 0; }
    .timeline-item {
      display: grid;
      grid-template-columns: 12px 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .timeline-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: ${RECAP_BRAND.primary};
      margin-top: 4px;
    }
    .timeline-title { font-weight: 700; font-size: ${RECAP_TYPO.small}; }
    .timeline-meta { font-size: 8.5pt; color: ${RECAP_BRAND.grey600}; margin-top: 2px; }
    .timeline-note { font-size: 9pt; margin-top: 4px; color: ${RECAP_BRAND.grey700}; }
    .comment {
      border-left: 2pt solid ${RECAP_BRAND.primary};
      padding: 6px 0 6px 12px;
      margin-bottom: 10px;
    }
    .comment-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 8.5pt;
      color: ${RECAP_BRAND.grey600};
      margin-bottom: 4px;
    }
    .comment-body { font-size: ${RECAP_TYPO.small}; }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .photo-cell {
      border-radius: 6px;
      overflow: hidden;
      border: ${border} solid ${RECAP_BRAND.grey200};
      aspect-ratio: 1;
      background: ${RECAP_BRAND.grey100};
    }
    .photo-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .doc-list { margin: 0; padding-left: 18px; }
    .doc-list li { margin-bottom: 3px; font-size: ${RECAP_TYPO.small}; }
    .work-visit-group {
      border: ${border} solid ${RECAP_BRAND.grey200};
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      background: ${RECAP_BRAND.grey50};
    }
    .work-visit-title {
      font-size: ${RECAP_TYPO.tiny};
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${RECAP_BRAND.info};
      margin-bottom: 6px;
    }
    .work-entry {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: ${border} dashed ${RECAP_BRAND.grey200};
    }
    .work-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .work-entry-text { font-size: ${RECAP_TYPO.small}; margin-bottom: 4px; }
    .work-entry-photos { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
    .work-entry-photo {
      width: 110px;
      height: 110px;
      border-radius: 6px;
      overflow: hidden;
      border: ${border} solid ${RECAP_BRAND.grey200};
      background: ${RECAP_BRAND.white};
    }
    .work-entry-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .work-entry-docs { margin: 4px 0 0; padding-left: 16px; font-size: 9pt; }
    .work-entry-docs li { margin-bottom: 2px; }
    .validation-block { margin-top: 2px; }
    .validation-block .badge { margin-bottom: 6px; }
    .validation-rows .row:first-child { margin-top: 4px; }
    .validation-rows .row-label { min-width: 38%; }
    .sig-visit { font-size: ${RECAP_TYPO.small}; margin: 0 0 10px; }
    .sig-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .sig-card {
      flex: 1 1 240px;
      border: ${border} solid ${RECAP_BRAND.grey200};
      border-radius: 8px;
      padding: 10px;
      background: ${RECAP_BRAND.white};
    }
    .sig-head { display: flex; flex-direction: column; gap: 2px; font-size: ${RECAP_TYPO.small}; margin-bottom: 4px; }
    .sig-time { font-size: ${RECAP_TYPO.tiny}; color: ${RECAP_BRAND.grey600}; margin-bottom: 6px; }
    .sig-img-wrap {
      border: ${border} dashed ${RECAP_BRAND.grey200};
      border-radius: 6px;
      padding: 6px;
      background: ${RECAP_BRAND.grey50};
      min-height: 72px;
    }
    .sig-img { max-width: 100%; max-height: 88px; display: block; object-fit: contain; }
  </style>
</head>
<body>
  <div class="recap-page">
  <div class="content">
    <div class="title-band">
      <div class="doc-kicker">${escapeHtml(docTitle)}</div>
      <div class="doc-title">${escapeHtml(job.clientName)}</div>
      <div class="doc-meta-line">${escapeHtml(typeMeta.description)} · Issued ${escapeHtml(generatedAt)} · Prepared by ${escapeHtml(generatedByName)}</div>
      <div class="badges">${statusBadge(job.status)} ${priorityBadge(job.priority)}${
        showValidation
          ? ` ${validationStatusBadge(validationDetails.tone, validationDetails.statusLabel)}`
          : ''
      }${
        job.lockedAt ? badge('Signed & locked', '#D1FAE5', RECAP_BRAND.success) : ''
      }</div>
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

    ${buildRecapValidationSectionHtml(job, options.documentType)}
    ${section('Client & site', clientSection, '◆')}
    ${contactsSection ? section('Site contacts', contactsSection, '◆') : ''}
    ${section('Mission & team', missionSection, '◆')}
    ${
      options.includeVisits
        ? section(
            'Visit timeline',
            `<table class="data-table">
        <thead><tr><th>#</th><th>Label</th><th>When</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>${visitRows}</tbody>
      </table>`,
            '◆',
          )
        : ''
    }
    ${options.includeWorkReport ? section('Work report', workSectionWithNotes, '◆') : ''}
    ${signaturesSection ? section('Signatures', signaturesSection, '◆') : ''}
    ${historyRows ? section('Schedule history', `<div class="timeline">${historyRows}</div>`, '◆') : ''}
    ${commentRows ? section('Comments', commentRows, '◆') : ''}
    ${photoGrid ? section('Site photos', photoGrid, '◆') : ''}
    ${docList ? section('Documents', docList, '◆') : ''}
  </div>
  </div>
</body>
</html>`;
}

export async function exportJobRecapPdf(
  job: JobCard,
  options: JobRecapExportOptions = defaultJobRecapExportOptions(job),
  meta: JobRecapPrintMeta = {},
): Promise<string> {
  const generatedAt = new Date();
  const assets = await prepareJobRecapAssets(job, options);
  const fileName = buildRecapPdfFileName(job, options.documentType, generatedAt);
  const typeMeta = RECAP_DOCUMENT_TYPE_META[options.documentType];
  const stampMeta: RecapPdfStampMeta = {
    appName: COMPANY.app,
    companyName: COMPANY.name,
    companyTagline: COMPANY.tagline,
    generatedDate: formatDate(generatedAt.toISOString()),
    generatedByName: meta.generatedByName?.trim() || '—',
    jobReference: job.reference || '—',
    documentTypeTag: typeMeta.tag,
    logoPngBase64: recapLogoBase64FromDataUri(assets.logoDataUri),
    isDraft: options.documentType === 'draft',
  };

  try {
    const serverHtml = buildJobRecapHtml(job, assets, options, meta);
    const serverUri = await renderRecapPdfOnServer(serverHtml, fileName, stampMeta);
    return await finalizeRecapPdf(serverUri, stampMeta, fileName);
  } catch {
    // Appwrite Chromium render unavailable — device fallback (lower quality).
  }

  const html = buildJobRecapHtml(job, assets, options, { ...meta, nativePrintMargins: true });
  const sideMm = RECAP_MARGIN_MM;
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: A4_WIDTH_PT,
    height: A4_HEIGHT_PT,
    margins: {
      top: mmToPt(RECAP_PAGE_TOP_MARGIN_MM),
      right: mmToPt(sideMm.right),
      bottom: mmToPt(RECAP_PAGE_BOTTOM_MARGIN_MM),
      left: mmToPt(sideMm.left),
    },
  });
  try {
    return await finalizeRecapPdf(uri, stampMeta, fileName);
  } catch {
    return assignRecapPdfFileName(uri, fileName);
  }
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
