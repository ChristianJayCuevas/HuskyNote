import { describe, expect, it } from 'vitest';
import en from '../src/locales/en.json';
import fr from '../src/locales/fr.json';
import ja from '../src/locales/ja.json';
import zh from '../src/locales/zh.json';

/** Every leaf key ("tour.controls.next") with its text */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, text] of leaves(value, prefix ? `${prefix}.${key}` : key)) out.set(path, text);
    }
  }
  return out;
}

/** Placeholders such as {n} and {total} */
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const english = leaves(en);

  it.each([
    ['fr', fr],
    ['ja', ja],
    ['zh', zh],
  ])('%s has exactly the English keys', (_, locale) => {
    const translated = leaves(locale);
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it.each([
    ['fr', fr],
    ['ja', ja],
    ['zh', zh],
  ])('%s keeps the placeholders of every English string', (_, locale) => {
    const translated = leaves(locale);
    for (const [key, text] of english) {
      expect([key, placeholders(translated.get(key) ?? '')]).toEqual([key, placeholders(text)]);
    }
  });

  it('French keeps its punctuation on the line: a non-breaking space before : ; ? ! » and after «', () => {
    for (const [key, text] of leaves(fr)) {
      expect([key, /[ ][:;?!»]|«[ ]/.test(text)]).toEqual([key, false]);
    }
  });

  it('has no empty strings', () => {
    for (const locale of [en, fr, ja, zh]) {
      for (const [key, text] of leaves(locale)) expect([key, text.trim().length > 0]).toEqual([key, true]);
    }
  });
});
