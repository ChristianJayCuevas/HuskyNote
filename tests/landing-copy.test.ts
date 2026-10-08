import { describe, it, expect } from 'vitest';
import { LANDING_COPY, flattenCopy, mapCopy } from '../src/components/landing/copy';

const leaves = flattenCopy();

// Claims the landing must not make: unverifiable social proof, absolute privacy or
// offline promises, and the upstream DomoNote headlines it replaced.
const BANNED: Array<[string, RegExp]> = [
  ['100%', /100\s*%/i],
  ['1-click', /\b(1|one)[-\s]?click\b/i],
  ['trusted by', /trusted by/i],
  ['users', /\busers?\b/i],
  ['customers', /\bcustomers?\b/i],
  ['rated', /\brated\b/i],
  ['award', /\baward/i],
  ['testimonial', /testimonial/i],
  ['zero risk', /zero risk/i],
  ['completely offline', /completely offline/i],
  ['never leave', /never leaves?/i],
  ['capture it. understand it', /capture it\.\s*understand it/i],
  ['personal ai secretary', /personal ai secretary/i],
  ['domonote', /domonote/i],
];

describe('landing copy', () => {
  it('has a reasonable number of strings, all non-empty', () => {
    expect(leaves.length).toBeGreaterThan(100);
    for (const [path, value] of leaves) {
      expect(value.trim(), path).not.toBe('');
      expect(value, path).toBe(value.trim());
    }
  });

  it('uses no emoji', () => {
    for (const [path, value] of leaves) {
      // © is the only pictographic character allowed (footer legal line)
      expect(/\p{Extended_Pictographic}|️/u.test(value.replace(/©/g, '')), `${path}: ${value}`).toBe(false);
    }
  });

  it('makes none of the banned claims', () => {
    for (const [path, value] of leaves) {
      for (const [label, pattern] of BANNED) {
        expect(pattern.test(value), `${path} contains "${label}": ${value}`).toBe(false);
      }
    }
  });

  it('keeps the agreed headline', () => {
    const { titleStart, titleMark, titleEnd } = LANDING_COPY.hero;
    expect(`${titleStart} ${titleMark} ${titleEnd}`).toBe('Sit. Stay. Take notes.');
  });

  it('maps every leaf to a home.* locale path and preserves the tree shape', () => {
    const seen: string[] = [];
    const mapped = mapCopy(LANDING_COPY, (path, value) => {
      seen.push(path);
      return value.toUpperCase();
    });
    expect(seen.every((path) => path.startsWith('home.'))).toBe(true);
    expect(seen).toContain('home.hero.titleMark');
    expect(seen).toContain('home.faq.items.0.q');
    expect(mapped.hero.titleMark).toBe('STAY.');
    expect(mapped.faq.items).toHaveLength(LANDING_COPY.faq.items.length);
    expect(LANDING_COPY.hero.titleMark).toBe('Stay.');
  });
});
