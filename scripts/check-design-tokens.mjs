#!/usr/bin/env node
// Flags styling that bypasses the design tokens (see SOT.md "Visual system").
//
//   node scripts/check-design-tokens.mjs [file-or-directory ...]
//
// With no arguments it scans src/ (skipping the landing page and src/brand). Directories are
// scanned recursively for .ts/.tsx/.js/.jsx; files passed explicitly are always scanned.
// A line is exempt when it, or the line above it, contains `design-exception: <reason>`.
// Exits 1 when any violation is found.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const SCRIPT_EXTENSIONS = /\.(tsx?|jsx?|mjs)$/;
// Skipped when walking directories (pass a file explicitly to scan it anyway)
const SKIPPED_PATHS = ['src/views/landing-page.tsx', 'src/components/landing/', 'src/brand/', 'node_modules/', 'dist/'];
const UI_DIR = 'src/components/ui/';

const PALETTE =
  '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const COLOR_UTILITY =
  '(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|accent|caret)';

/** Each rule: id, regex (global), message. `buttonOnly` rules apply only to props of <Button>. */
const RULES = [
  {
    id: 'palette-color',
    re: new RegExp(`(?<![\\w-])${COLOR_UTILITY}-${PALETTE}-\\d{2,3}(?:\\/\\d{1,3})?(?![\\w-])`, 'g'),
    message: 'Tailwind palette color; use a semantic token (bg-background, text-muted-foreground, border-border, text-success, bg-chart-1, ...)',
  },
  {
    id: 'canvas',
    re: /(?<![\w-])(?:bg|text|border|from|via|to|ring|fill|stroke|divide|outline)-canvas(?:-inset)?(?![\w-])/g,
    message: 'deprecated canvas color; use bg-background or bg-sidebar',
  },
  {
    id: 'dark-variant',
    re: /(?<![\w-])dark:[\w[\]/.%-]+/g,
    message: 'dark: variant outside src/components/ui; tokens already switch with the theme',
    skipInUi: true,
  },
  {
    id: 'hex-color',
    re: /(?<=["'`[(,]|:\s?)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
    message: 'hex color literal; use a token',
  },
  {
    id: 'color-function',
    re: /(?<![\w-])(?:rgba?|hsla?)\(\s*[\d.]/g,
    message: 'rgb()/hsl() color literal; use a token (hsl(var(--token)) is fine)',
  },
  {
    id: 'white-black',
    re: /(?<![\w-])(?:bg|text)-(?:white|black)(?:\/\d{1,3})?(?![\w-])/g,
    message: 'bg-white/black or text-white/black; use bg-background, text-foreground, bg-primary text-primary-foreground, ...',
  },
  {
    id: 'deprecated-variant',
    re: /variant=(?:"(?:primary|danger)"|'(?:primary|danger)'|\{[^}]*['"](?:primary|danger)['"][^}]*\})/g,
    message: 'deprecated Button variant; use variant="default" or "destructive"',
    buttonOnly: true,
  },
  {
    id: 'deprecated-size',
    re: /size=(?:"md"|'md'|\{[^}]*['"]md['"][^}]*\})/g,
    message: 'deprecated Button size "md"; use size="default" (or omit it)',
    buttonOnly: true,
  },
  { id: 'backdrop-blur', re: /(?<![\w-])backdrop-blur(?:-[\w[\]]+)?(?![\w-])/g, message: 'backdrop-blur is not part of the visual system' },
  { id: 'duration-500', re: /(?<![\w-])duration-500(?![\w-])/g, message: 'duration-500 is too slow; use duration-100 (hover) to duration-200 (dialogs)' },
  { id: 'transition-all', re: /(?<![\w-])transition-all(?![\w-])/g, message: 'transition-all; use transition-colors, transition-opacity, transition-transform or transition-[...]' },
  { id: 'scale-effect', re: /(?<![\w-])(?:active|hover|group-hover):scale-[\w[\].]+/g, message: 'press/hover scale effects are not part of the visual system' },
  {
    id: 'large-radius',
    re: /(?<![\w-])rounded-(?:[trblse]{1,2}-)?(?:2xl|3xl)(?![\w-])/g,
    message: 'rounded-2xl/3xl; use rounded-md (controls), rounded-lg (cards, menus) or rounded-xl (dialogs)',
  },
  { id: 'shadow-2xl', re: /(?<![\w-])shadow-2xl(?![\w-])/g, message: 'shadow-2xl; use shadow-lg (popovers) or shadow-xl (dialogs)' },
  { id: 'heavy-weight', re: /(?<![\w-])font-(?:extrabold|black)(?![\w-])/g, message: 'font-extrabold/black; the heaviest weight is font-bold for document titles' },
];

const EXCEPTION = /design-exception:\s*\S/;

function toPosix(p) {
  return p.split(sep).join('/');
}

function collect(target, explicit, out) {
  const abs = resolve(root, target);
  if (!existsSync(abs)) {
    console.error(`check-design-tokens: no such file or directory: ${target}`);
    process.exitCode = 2;
    return;
  }
  const rel = toPosix(relative(root, abs));
  const stat = statSync(abs);
  if (stat.isDirectory()) {
    if (!explicit && SKIPPED_PATHS.some((skip) => `${rel}/`.startsWith(skip))) return;
    for (const entry of readdirSync(abs)) collect(join(abs, entry), false, out);
    return;
  }
  if (!SCRIPT_EXTENSIONS.test(abs)) return;
  if (!explicit && SKIPPED_PATHS.some((skip) => rel.startsWith(skip))) return;
  out.add(abs);
}

/** Name of the JSX element whose props contain `index` (nearest unclosed `<Tag` before it). */
function enclosingTag(text, index) {
  const before = text.slice(Math.max(0, index - 2000), index);
  const re = /<([A-Za-z][\w.]*)/g;
  let match;
  let last = null;
  while ((match = re.exec(before))) last = { name: match[1], at: match.index };
  if (!last) return null;
  // If the tag was already closed (">" outside braces) before index, we are not inside its props
  const between = before.slice(last.at);
  let depth = 0;
  for (const ch of between) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return null;
  }
  return last.name;
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const rel = toPosix(relative(root, file));
  const inUi = rel.startsWith(UI_DIR);
  // Line starts come from the real "\n" positions so CRLF files keep correct line numbers
  // (and design-exception comments are matched against the right lines).
  const lines = text.split(/\r?\n/);
  const lineStarts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) lineStarts.push(i + 1);
  lineStarts.length = lines.length;
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const violations = [];
  for (const rule of RULES) {
    if (rule.skipInUi && inUi) continue;
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(text))) {
      const lineIndex = lineOf(match.index);
      const line = lines[lineIndex];
      const previous = lineIndex > 0 ? lines[lineIndex - 1] : '';
      if (EXCEPTION.test(line) || EXCEPTION.test(previous)) continue;
      if (rule.buttonOnly && enclosingTag(text, match.index) !== 'Button') continue;
      violations.push({
        file: rel,
        line: lineIndex + 1,
        column: match.index - lineStarts[lineIndex] + 1,
        rule: rule.id,
        found: match[0].slice(0, 60),
        message: rule.message,
      });
    }
  }
  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}

const targets = process.argv.slice(2);
const files = new Set();
for (const target of targets.length ? targets : ['src']) collect(target, targets.length > 0, files);

let total = 0;
const perRule = new Map();
for (const file of [...files].sort()) {
  for (const v of scanFile(file)) {
    total++;
    perRule.set(v.rule, (perRule.get(v.rule) ?? 0) + 1);
    console.log(`${v.file}:${v.line}:${v.column}  ${v.rule}  ${v.found}  (${v.message})`);
  }
}

if (total > 0) {
  const summary = [...perRule.entries()].map(([rule, count]) => `${rule} ${count}`).join(', ');
  console.log(`\n${total} design-token violation${total === 1 ? '' : 's'} in ${files.size} scanned file${files.size === 1 ? '' : 's'} (${summary}).`);
  console.log('Exempt a deliberate case with a `design-exception: <reason>` comment on the line or the line above.');
  process.exitCode = 1;
} else if (process.exitCode !== 2) {
  console.log(`Design tokens OK: ${files.size} file${files.size === 1 ? '' : 's'} scanned, 0 violations.`);
}
