/**
 * stealth-labels.test.ts
 *
 * Vitest unit tests for src/lib/stealth-labels.ts
 *
 * Coverage:
 *   - Persistence across reads (localStorage round-trip)
 *   - Wallet isolation (wallet A labels invisible to wallet B)
 *   - Label length cap (64 chars)
 *   - Tag cap (10 tags, 32 chars each)
 *   - Privacy notice flag (isFirstEver, hasSeenPrivacyNotice)
 *   - Hide / unhide / delete
 *   - filterLabels: query, tag, showHidden combinations
 *   - getAllTags
 *   - exportLabels / importLabels with all three conflict strategies
 *   - Empty walletPubkey is a no-op (never throws)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteLabel,
  exportLabels,
  filterLabels,
  getAllLabels,
  getAllTags,
  getLabel,
  hasSeenPrivacyNotice,
  hideLabel,
  importLabels,
  markPrivacyNoticeSeen,
  unhideLabel,
  upsertLabel,
  LABEL_MAX_LEN,
  MAX_TAGS,
  TAG_MAX_LEN,
} from './stealth-labels';

// jsdom provides localStorage; Vitest with jsdom env is assumed.

const W1 = 'GBTEST111111111111111111111111111111111111111111111111111111';
const W2 = 'GBTEST222222222222222222222222222222222222222222222222222222';
const ADDR_A = 'GASTEALTH_AAAA';
const ADDR_B = 'GASTEALTH_BBBB';

beforeEach(() => {
  localStorage.clear();
});

// ─── Basic CRUD ───────────────────────────────────────────────────────────────

describe('upsertLabel', () => {
  it('creates a new label and returns isFirstEver=true on first save', () => {
    const { saved, isFirstEver } = upsertLabel(W1, ADDR_A, { label: 'Rent' });
    expect(saved.label).toBe('Rent');
    expect(isFirstEver).toBe(true);
    expect(saved.createdAt).toBeGreaterThan(0);
  });

  it('isFirstEver=false on second save for same wallet', () => {
    upsertLabel(W1, ADDR_A, { label: 'Rent' });
    const { isFirstEver } = upsertLabel(W1, ADDR_B, { label: 'Tip' });
    expect(isFirstEver).toBe(false);
  });

  it('updates existing label without changing createdAt', () => {
    const { saved: first } = upsertLabel(W1, ADDR_A, { label: 'Rent' });
    const { saved: second } = upsertLabel(W1, ADDR_A, { label: 'Rent – May' });
    expect(second.label).toBe('Rent – May');
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('enforces LABEL_MAX_LEN', () => {
    const long = 'x'.repeat(LABEL_MAX_LEN + 20);
    const { saved } = upsertLabel(W1, ADDR_A, { label: long });
    expect(saved.label.length).toBe(LABEL_MAX_LEN);
  });

  it('enforces MAX_TAGS', () => {
    const tooMany = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`);
    const { saved } = upsertLabel(W1, ADDR_A, { tags: tooMany });
    expect(saved.tags.length).toBe(MAX_TAGS);
  });

  it('enforces TAG_MAX_LEN per tag', () => {
    const longTag = 'y'.repeat(TAG_MAX_LEN + 10);
    const { saved } = upsertLabel(W1, ADDR_A, { tags: [longTag] });
    expect(saved.tags[0].length).toBe(TAG_MAX_LEN);
  });

  it('is a no-op for empty walletPubkey', () => {
    expect(() => upsertLabel('', ADDR_A, { label: 'x' })).not.toThrow();
    expect(getAllLabels('')).toHaveLength(0);
  });
});

describe('getLabel', () => {
  it('returns null for unknown address', () => {
    expect(getLabel(W1, ADDR_A)).toBeNull();
  });
  it('returns the stored label', () => {
    upsertLabel(W1, ADDR_A, { label: 'Freelance' });
    expect(getLabel(W1, ADDR_A)?.label).toBe('Freelance');
  });
});

describe('wallet isolation', () => {
  it('labels from W1 are invisible to W2', () => {
    upsertLabel(W1, ADDR_A, { label: 'Private' });
    expect(getAllLabels(W2)).toHaveLength(0);
    expect(getLabel(W2, ADDR_A)).toBeNull();
  });
});

// ─── Hide / unhide / delete ───────────────────────────────────────────────────

describe('hideLabel / unhideLabel', () => {
  it('sets hiddenAt after hide', () => {
    upsertLabel(W1, ADDR_A, { label: 'x' });
    hideLabel(W1, ADDR_A);
    expect(getLabel(W1, ADDR_A)?.hiddenAt).toBeDefined();
  });
  it('clears hiddenAt after unhide', () => {
    upsertLabel(W1, ADDR_A, { label: 'x' });
    hideLabel(W1, ADDR_A);
    unhideLabel(W1, ADDR_A);
    expect(getLabel(W1, ADDR_A)?.hiddenAt).toBeUndefined();
  });
});

describe('deleteLabel', () => {
  it('removes the entry', () => {
    upsertLabel(W1, ADDR_A, { label: 'x' });
    deleteLabel(W1, ADDR_A);
    expect(getLabel(W1, ADDR_A)).toBeNull();
  });
});

// ─── Privacy notice ───────────────────────────────────────────────────────────

describe('privacy notice', () => {
  it('returns false before any save', () => {
    expect(hasSeenPrivacyNotice(W1)).toBe(false);
  });
  it('returns true after markPrivacyNoticeSeen', () => {
    markPrivacyNoticeSeen(W1);
    expect(hasSeenPrivacyNotice(W1)).toBe(true);
  });
  it('is scoped to wallet', () => {
    markPrivacyNoticeSeen(W1);
    expect(hasSeenPrivacyNotice(W2)).toBe(false);
  });
});

// ─── filterLabels ─────────────────────────────────────────────────────────────

describe('filterLabels', () => {
  function seed() {
    upsertLabel(W1, ADDR_A, { label: 'Rent payment', tags: ['housing', 'monthly'] });
    upsertLabel(W1, ADDR_B, { label: 'Freelance gig', tags: ['work'] });
  }

  it('returns all visible by default', () => {
    seed();
    const all = getAllLabels(W1);
    expect(filterLabels(all, {})).toHaveLength(2);
  });

  it('filters by label substring (case-insensitive)', () => {
    seed();
    const all = getAllLabels(W1);
    expect(filterLabels(all, { query: 'rent' })).toHaveLength(1);
    expect(filterLabels(all, { query: 'RENT' })).toHaveLength(1);
  });

  it('filters by tag (exact match)', () => {
    seed();
    const all = getAllLabels(W1);
    expect(filterLabels(all, { tag: 'housing' })).toHaveLength(1);
    expect(filterLabels(all, { tag: 'nonexistent' })).toHaveLength(0);
  });

  it('excludes hidden entries by default', () => {
    seed();
    hideLabel(W1, ADDR_A);
    const all = getAllLabels(W1);
    expect(filterLabels(all, {})).toHaveLength(1);
  });

  it('includes hidden entries when showHidden=true', () => {
    seed();
    hideLabel(W1, ADDR_A);
    const all = getAllLabels(W1);
    expect(filterLabels(all, { showHidden: true })).toHaveLength(2);
  });
});

// ─── getAllTags ───────────────────────────────────────────────────────────────

describe('getAllTags', () => {
  it('returns sorted unique tags from visible labels', () => {
    upsertLabel(W1, ADDR_A, { tags: ['zzz', 'aaa'] });
    upsertLabel(W1, ADDR_B, { tags: ['aaa', 'mmm'] });
    const tags = getAllTags(W1);
    expect(tags).toEqual(['aaa', 'mmm', 'zzz']);
  });
  it('excludes tags from hidden labels', () => {
    upsertLabel(W1, ADDR_A, { tags: ['hidden-tag'] });
    hideLabel(W1, ADDR_A);
    expect(getAllTags(W1)).not.toContain('hidden-tag');
  });
});

// ─── Export / Import ──────────────────────────────────────────────────────────

describe('exportLabels / importLabels', () => {
  it('round-trips all labels through JSON', () => {
    upsertLabel(W1, ADDR_A, { label: 'Rent', tags: ['housing'] });
    const json = exportLabels(W1);
    localStorage.clear();
    const result = importLabels(W1, json, 'overwrite');
    expect(result.imported).toBe(1);
    expect(getLabel(W1, ADDR_A)?.label).toBe('Rent');
  });

  it('keep-existing skips conflicting entries', () => {
    upsertLabel(W1, ADDR_A, { label: 'Original' });
    const json = exportLabels(W1);
    upsertLabel(W1, ADDR_A, { label: 'Changed' });
    const result = importLabels(W1, json, 'keep-existing');
    expect(result.skipped).toBe(1);
    expect(getLabel(W1, ADDR_A)?.label).toBe('Changed');
  });

  it('overwrite replaces conflicting entries', () => {
    upsertLabel(W1, ADDR_A, { label: 'Original' });
    const json = exportLabels(W1);
    upsertLabel(W1, ADDR_A, { label: 'Changed' });
    importLabels(W1, json, 'overwrite');
    expect(getLabel(W1, ADDR_A)?.label).toBe('Original');
  });

  it('merge-tags unions tag arrays, keeps existing label', () => {
    upsertLabel(W1, ADDR_A, { label: 'Mine', tags: ['aaa'] });
    const json = exportLabels(W1);
    upsertLabel(W1, ADDR_A, { label: 'Updated', tags: ['bbb'] });
    importLabels(W1, json, 'merge-tags');
    const saved = getLabel(W1, ADDR_A)!;
    expect(saved.label).toBe('Updated');   // local label kept
    expect(saved.tags).toContain('aaa');
    expect(saved.tags).toContain('bbb');
  });

  it('returns zeros on invalid JSON', () => {
    const result = importLabels(W1, 'not-json', 'keep-existing');
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('is a no-op for empty walletPubkey', () => {
    expect(() => importLabels('', '{}', 'keep-existing')).not.toThrow();
  });
});