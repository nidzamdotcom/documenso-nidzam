// patch-nidzam.mjs: rebrands the built Documenso app as NIDZAM.COM.
// Runs inside the image build (see Dockerfile). It only rewrites built files:
// logo SVGs, image assets, and user-facing text. Code identifiers, HTTP headers
// (X-Documenso-*), env names and package names are left alone.
// Every step checks how many places it changed and fails the build if that
// differs from what was seen in v2.20.0, so an upgrade can't silently half-apply.
import fs from 'node:fs';
import path from 'node:path';

const BUILD = '/app/apps/remix/build';
const ASSETS = '/nidzam';
const NAME = 'NIDZAM.COM';
const report = [];

const fail = (msg) => {
  console.error(`patch-nidzam: ${msg}`);
  process.exit(1);
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(m?js)$/.test(e.name) ? [p] : [];
  });

const files = walk(BUILD);
const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const changed = new Set();

const set = (f, s) => {
  if (s !== src.get(f)) {
    src.set(f, s);
    changed.add(f);
  }
};

// ---- 1. Logo SVG components ------------------------------------------------

// Index just past the bracket matching the one at `i`, skipping strings and comments.
const matchEnd = (s, i) => {
  const open = s[i];
  const close = { '[': ']', '(': ')', '{': '}' }[open];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') {
      for (j++; j < s.length && s[j] !== c; j++) if (s[j] === '\\') j++;
      continue;
    }
    if (c === '/' && s[j + 1] === '*') {
      j = s.indexOf('*/', j + 2) + 1;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  fail(`unbalanced ${open} at ${i}`);
};

const patchSvg = (oldViewBox, spec, expected) => {
  let count = 0;
  for (const f of files) {
    let s = src.get(f);
    const re = new RegExp(`viewBox:\\s*"${oldViewBox}"`, 'g');
    let m;
    while ((m = re.exec(s))) {
      const at = m.index;
      // jsx runtime call that opened this <svg>, e.g. `c.jsxs("svg"` or `jsxs("svg"`
      const head = s.slice(Math.max(0, at - 300), at);
      const call = [...head.matchAll(/([\w$]+\.)?jsxs?\(\s*"svg"/g)].pop();
      if (!call) fail(`no svg call before ${oldViewBox} in ${f}`);
      const jsx = `${call[1] ?? ''}jsx`;
      const ci = s.indexOf('children:', at);
      let vi = ci + 'children:'.length;
      while (/\s/.test(s[vi])) vi++;
      // value is either [...] or a call like l.jsxs("g",{...}) possibly after a /* @__PURE__ */ comment
      let end;
      if (s[vi] === '[') end = matchEnd(s, vi);
      else {
        let k = vi;
        if (s.startsWith('/*', k)) k = s.indexOf('*/', k) + 2;
        while (/[\s\w$.]/.test(s[k])) k++;
        if (s[k] !== '(') fail(`unexpected children value in ${f}`);
        end = matchEnd(s, k);
      }
      const paths = spec.paths.map(
        (p, i) =>
          `${jsx}("path",{d:${JSON.stringify(p.d)},fill:${JSON.stringify(p.fill)}` +
          `${p.fillRule ? `,fillRule:${JSON.stringify(p.fillRule)}` : ''}},"nz${i}")`,
      );
      const replacement = `viewBox:"${spec.viewBox}"` + s.slice(at + m[0].length, vi) + `[${paths.join(',')}]`;
      s = s.slice(0, at) + replacement + s.slice(end);
      re.lastIndex = at + replacement.length;
      count++;
    }
    set(f, s);
  }
  if (count !== expected) fail(`svg ${oldViewBox}: expected ${expected} components, patched ${count}`);
  report.push(`svg ${oldViewBox} -> ${spec.viewBox}: ${count}`);
};

patchSvg('0 0 2248 320', JSON.parse(fs.readFileSync(`${ASSETS}/ui/wordmark.json`, 'utf8')), 2);
patchSvg('0 0 84 84', JSON.parse(fs.readFileSync(`${ASSETS}/ui/icon.json`, 'utf8')), 2);

// ---- 2. Hashed image assets -------------------------------------------------

const clientAssets = path.join(BUILD, 'client/assets');
const replacedImages = [];
for (const [prefix, file] of [
  ['logo-', 'logo.png'],
  ['logo_icon-', 'logo_icon.png'],
  ['signing-celebration-', 'signing-celebration.png'],
  ['timur-', 'timur.png'],
]) {
  const hits = fs.readdirSync(clientAssets).filter((n) => n.startsWith(prefix) && n.endsWith('.png'));
  if (hits.length !== 1) fail(`asset ${prefix}*.png: expected 1, found ${hits.length}`);
  fs.copyFileSync(`${ASSETS}/ui/${file}`, path.join(clientAssets, hits[0]));
  replacedImages.push(hits[0]);
  report.push(`image ${hits[0]} <- ${file}`);
}

// ---- 3. Text ------------------------------------------------------------------

// [pattern, replacement, minimum number of replacements across all files]
const RULES = [
  [/Join Documenso, the open signing infrastructure[^"`]*/g, `Sign documents securely with ${NAME}.`, 2],
  [/Documenso, open source, DocuSign alternative[^"`]*/g, `${NAME}, document signing, e-signature`, 2],
  [/Documenso - The Open Source DocuSign Alternative/g, `${NAME} - Secure document signing`, 2],
  [/Documenso - Join the open source signing revolution/g, `${NAME} - Secure document signing`, 2],
  [/Documenso, Inc\./g, NAME, 3],
  [/image of timur ercan founder of documenso/g, NAME, 1],
  [/Timur Ercan/g, NAME, 1],
  [/"\/u\/timur"/g, '"/u/nidzam"', 1],
  [/https:\/\/documen\.so\/mail-footer/g, 'https://nidzam.com', 1],
  // "Want to send slick signing links like this one? Check out Documenso." -> empty, in every language
  [/(\\?)"SoyL72\1":\[(?:\\?"(?:[^"\\]|\\.)*?\\?")\]/g, '$1"SoyL72$1":[$1"$1"]', 10],
  // everything else: the product name in user-facing strings
  [/(?<![\w\-.@/])Documenso(?![\w-])/g, NAME, 100],
];

for (const [re, to, min] of RULES) {
  let n = 0;
  for (const f of files) {
    const s = src.get(f);
    const out = s.replace(re, (...a) => {
      n++;
      return to.replace(/\$1/g, a[1] ?? '');
    });
    set(f, out);
  }
  if (n < min) fail(`text ${re}: expected at least ${min}, replaced ${n}`);
  report.push(`text ${re} -> ${n}`);
}

// ---- 4. New names for changed browser assets ------------------------------------
// /assets/* is served as "immutable" for a year, so Cloudflare and browsers would
// keep the old Documenso files under their old names. Every changed asset gets a
// new name (x.js -> x.nz.js), and so does every asset that refers to a renamed
// one, repeated until nothing new is found. Pages (HTML) aren't cached, and the
// server bundle only has its references updated.

const assetNames = fs.readdirSync(clientAssets);
const assetText = (n) => src.get(path.join(clientAssets, n)) ?? fs.readFileSync(path.join(clientAssets, n), 'utf8');
const textAssets = assetNames.filter((n) => /\.(m?js|css)$/.test(n));
const renamed = new Map();
const rename = (n) => {
  if (renamed.has(n)) return false;
  const dot = n.lastIndexOf('.');
  renamed.set(n, `${n.slice(0, dot)}.nz${n.slice(dot)}`);
  return true;
};
for (const f of changed) if (path.dirname(f) === clientAssets) rename(path.basename(f));
replacedImages.forEach(rename);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refPattern = () => new RegExp(`(?<![\\w.-])(?:${[...renamed.keys()].map(esc).join('|')})(?![\\w-])`, 'g');
for (let grew = true; grew; ) {
  grew = false;
  const re = refPattern();
  for (const n of textAssets) {
    if (renamed.has(n)) continue;
    re.lastIndex = 0;
    if (re.test(assetText(n))) grew = rename(n) || grew;
  }
}

const refs = refPattern();
let refCount = 0;
const allText = [...files, ...textAssets.filter((n) => n.endsWith('.css')).map((n) => path.join(clientAssets, n))];
for (const f of allText) {
  const s = src.get(f) ?? fs.readFileSync(f, 'utf8');
  const out = s.replace(refs, (m) => {
    refCount++;
    return renamed.get(m);
  });
  if (out !== s) {
    src.set(f, out);
    changed.add(f);
  }
}
if (renamed.size < 10 || refCount < renamed.size) fail(`rename: ${renamed.size} files, ${refCount} references`);
report.push(`renamed ${renamed.size} browser assets, ${refCount} references updated`);

// ---- write + sanity checks ----------------------------------------------------

for (const f of changed) fs.writeFileSync(f, src.get(f));
for (const [from, to] of renamed) fs.renameSync(path.join(clientAssets, from), path.join(clientAssets, to));

const leftovers = [];
for (const f of files) {
  for (const m of src.get(f).matchAll(/.{0,40}Documenso.{0,40}/g)) {
    // allowed: identifiers (isDocumensoCloud, DocumensoLogo...), X-Documenso-* headers
    if (/(?<![\w\-.@/])Documenso(?![\w-])/.test(m[0])) leftovers.push(`${f}: ${m[0]}`);
  }
}
if (leftovers.length) fail(`plain "Documenso" left:\n${leftovers.slice(0, 20).join('\n')}`);

report.push(`files changed: ${changed.size}`);
fs.writeFileSync('/nidzam/patch-report.txt', report.join('\n') + '\n');
console.log(report.join('\n'));
