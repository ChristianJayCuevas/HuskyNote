#!/usr/bin/env node
/**
 * Prints the GitHub release notes for a version from the in-app changelog
 * (src/data/changelog.json), so both always say the same thing.
 *
 * Usage: node scripts/release-notes.mjs v0.5.0
 * Fails if the version is missing from the changelog or does not match package.json.
 */
import { readFileSync } from 'node:fs';

const tag = process.argv[2];
if (!tag) {
  console.error('usage: node scripts/release-notes.mjs <tag, e.g. v0.5.0>');
  process.exit(1);
}
const version = tag.replace(/^v/, '');

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (pkg.version !== version) {
  console.error(`Tag ${tag} does not match package.json version ${pkg.version}.`);
  process.exit(1);
}

const releases = JSON.parse(readFileSync(new URL('../src/data/changelog.json', import.meta.url), 'utf8'));
const release = releases.find((r) => r.version.replace(/^v/, '') === version);
if (!release) {
  console.error(`No changelog entry for ${version} in src/data/changelog.json.`);
  process.exit(1);
}

const lines = [
  `## ${release.title}`,
  '',
  ...release.highlights.map((h) => `- ${h}`),
  '',
  '### Downloads',
  '',
  '| Platform | File |',
  '| --- | --- |',
  '| Windows installer | `HuskyNote-Setup-x64.exe` |',
  '| Windows portable | `HuskyNote-Windows-Portable.zip` |',
  '| macOS (Apple Silicon and Intel) | `HuskyNote-macOS-Universal.dmg` |',
  '| macOS (Apple Silicon only / Intel only) | `HuskyNote-macOS-arm64.dmg` / `HuskyNote-macOS-x64.dmg` |',
  '| Linux | `HuskyNote-Linux-x86_64.AppImage` or `HuskyNote-Linux-x64.tar.gz` |',
  '',
  'The macOS app is not notarized, so macOS warns on first launch; run `Open HuskyNote.command` from the disk image once to clear the warning. The Linux AppImage needs FUSE 2 (`libfuse2`); without it, use the tarball. Verify downloads with `SHA256SUMS.txt`.',
];
console.log(lines.join('\n'));
