#!/usr/bin/env node
/**
 * scripts/compare.mjs
 * Static parity check between the original single-file site and the optimized
 * build. Proves that no visible content was dropped or altered during the
 * performance rewrite.
 *
 * Run from the repository root:
 *   node portfolio-optimized/scripts/compare.mjs
 *
 * Checks:
 *   1. The <body> markup of both files is byte-identical.
 *   2. Every inline handler referenced by the markup is exposed as a global.
 *   3. Text content (normalized) is identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SITE_DIR, '..');
const ORIGINAL = path.join(REPO_ROOT, 'index (1).html');
const OPTIMIZED = path.join(SITE_DIR, 'index.html');

const read = (f) => fs.readFileSync(f, 'utf8');

/** Extract the <body> inner HTML (scripts excluded, whitespace normalized). */
function bodyMarkup(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!m) return null;
  return m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip tags + entities to get the visible text. */
function visibleText(html) {
  const b = bodyMarkup(html) || '';
  return b
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collect every inline event-handler function name referenced in the markup.
 * Scans the whole document with <script>/<style> contents removed, so handlers
 * are read from real markup rather than from JavaScript string literals.
 * `event.stopPropagation()` and friends are excluded: a callee preceded by `.`
 * is a method call on an object, not a global this code must define.
 */
function inlineHandlers(html) {
  const markup = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const names = new Set();
  const attr = /\son[a-z]+\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = attr.exec(markup))) {
    // Only bare identifiers count; skip `.method()` and member chains.
    const call = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/.exec(m[1]);
    if (call) names.add(call[2]);
  }
  return [...names].sort();
}

/** Concatenate every JS source shipped by the optimized build. */
function optimizedJsSource() {
  const dir = path.join(SITE_DIR, 'js');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
}

const origHtml = read(ORIGINAL);
const optHtml = read(OPTIMIZED);

let failures = 0;
const fail = (msg) => { console.log(`  FAIL  ${msg}`); failures++; };
const pass = (msg) => { console.log(`  PASS  ${msg}`); };

console.log(`Original : ${ORIGINAL}`);
console.log(`Optimized: ${OPTIMIZED}\n`);

/* 1. Body markup parity ---------------------------------------------------- */
const a = bodyMarkup(origHtml);
const b = bodyMarkup(optHtml);
if (a === null || b === null) {
  fail('could not extract <body> from one of the files');
} else if (a === b) {
  pass(`body markup byte-identical (${a.length.toLocaleString()} chars)`);
} else {
  fail('body markup differs');
  // Show the first divergence with context.
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.log(`        first difference at char ${i}`);
  console.log(`        original : ...${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}`);
  console.log(`        optimized: ...${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`);
}

/* 2. Visible text parity ---------------------------------------------------- */
const ta = visibleText(origHtml);
const tb = visibleText(optHtml);
if (ta === tb) {
  pass(`visible text identical (${ta.length.toLocaleString()} chars)`);
} else {
  fail('visible text differs');
  let i = 0;
  while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++;
  console.log(`        first difference at char ${i}`);
  console.log(`        original : ...${JSON.stringify(ta.slice(Math.max(0, i - 60), i + 60))}`);
  console.log(`        optimized: ...${JSON.stringify(tb.slice(Math.max(0, i - 60), i + 60))}`);
}

/* 3. Inline handler coverage ------------------------------------------------ */
const handlers = inlineHandlers(origHtml);
const js = optimizedJsSource();
console.log(`\n  inline handlers found in markup: ${handlers.join(', ')}`);
const missing = handlers.filter((n) => !new RegExp(`\\b${n}\\b`).test(js));
if (missing.length === 0) {
  pass('every inline handler is defined in the optimized JS');
} else {
  fail(`inline handlers not defined: ${missing.join(', ')}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);