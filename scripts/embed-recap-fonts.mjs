/**
 * Embeds Inter woff2 as @font-face CSS for print PDFs (vector text, no web fonts at render).
 * Run: npm run recap:embed-fonts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = join(root, 'node_modules', '@fontsource', 'inter', 'files');

function toDataUri(fileName) {
  const buf = readFileSync(join(filesDir, fileName));
  return `data:font/woff2;base64,${buf.toString('base64')}`;
}

const regular = toDataUri('inter-latin-400-normal.woff2');
const semibold = toDataUri('inter-latin-600-normal.woff2');
const bold = toDataUri('inter-latin-700-normal.woff2');

const css = `/** Auto-generated — npm run recap:embed-fonts */
export const RECAP_FONT_FAMILY = "'Inter', Helvetica, Arial, sans-serif";

export const RECAP_FONT_FACE_CSS = \`
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${regular}) format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url(${semibold}) format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(${bold}) format('woff2');
}
\`;
`;

writeFileSync(join(root, 'lib', 'jobRecapPdfFonts.ts'), css, 'utf8');
console.log('Wrote lib/jobRecapPdfFonts.ts');
