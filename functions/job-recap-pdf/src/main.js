import { Client, ID, Permission, Role, Storage, Users } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BUCKET_ID = 'job_attachments';

/** 300 DPI print target (96 CSS px/in). */
const PDF_PRINT_DPI = 300;
const PDF_DEVICE_SCALE = Math.max(4, PDF_PRINT_DPI / 96);

/** Margins come from HTML @page; puppeteer margin 0 avoids double inset. */
const PAGE_MARGIN = { top: '0', right: '0', bottom: '0', left: '0' };

function adminClient(req) {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? process.env.APPWRITE_API_KEY);
}

function parseBody(req) {
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: PDF_DEVICE_SCALE },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90_000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: PAGE_MARGIN,
    });
  } finally {
    await browser.close();
  }
}

export default async ({ req, res, log, error }) => {
  if (req.method !== 'POST') {
    return res.json({ ok: false, error: 'POST required.' }, 405);
  }

  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    return res.json({ ok: false, error: 'Sign in required.' }, 401);
  }

  const body = parseBody(req);
  if ((body.action ?? 'render') !== 'render') {
    return res.json({ ok: false, error: 'Unknown action.' }, 400);
  }

  const html = typeof body.html === 'string' ? body.html : '';
  if (!html.trim()) {
    return res.json({ ok: false, error: 'html is required.' }, 400);
  }

  const fileName =
    typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim()
      : 'recap.pdf';

  try {
    await Users(adminClient(req)).get(userId);
  } catch {
    return res.json({ ok: false, error: 'Invalid session.' }, 401);
  }

  try {
    log('Rendering recap PDF (Chromium, vector text + embedded fonts in HTML)...');
    const pdfBytes = await htmlToPdf(html);
    const storage = new Storage(adminClient(req));
    const fileId = ID.unique();
    await storage.createFile(
      BUCKET_ID,
      fileId,
      InputFile.fromBuffer(Buffer.from(pdfBytes), 'application/pdf', fileName),
      [Permission.read(Role.user(userId))],
    );
    log(`Recap PDF stored: ${fileId}`);
    return res.json({ ok: true, fileId, fileName });
  } catch (err) {
    error(err?.message ?? err);
    return res.json(
      { ok: false, error: err?.message ?? 'PDF render failed.' },
      500,
    );
  }
};
