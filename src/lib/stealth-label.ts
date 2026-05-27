/**
 * stealth-labels.ts
 *
 * Pure localStorage storage layer for per-wallet stealth-address labels.
 *
 * PRIVACY GUARANTEES (enforced here, not in the UI):
 *   • Every function requires a `walletPubkey`. If it is empty/undefined,
 *     all reads return empty and all writes are no-ops — labels from wallet A
 *     are never readable by wallet B.
 *   • Labels are stored ONLY in localStorage. Nothing is ever sent to the network.
 *   • The one-time "first save" flag is also per-wallet.
 *   • Export produces a plain JSON blob; import merges into the current wallet only.
 *
 * Key schema:
 *   wraith:labels:<walletPubkey>                   → Record<stealthAddress, StealthLabel>
 *   wraith:labels:<walletPubkey>:seen-privacy-notice → "1"
 */

export interface StealthLabel {
  stealthAddress: string;
  label: string;       // user-chosen, max LABEL_MAX_LEN chars
  tags: string[];      // optional freeform tags, max TAG_MAX_LEN each
  hiddenAt?: number;   // epoch ms — set when archived; absent = visible
  createdAt: number;   // epoch ms — set on first save, never mutated
}

export const LABEL_MAX_LEN = 64;
export const TAG_MAX_LEN   = 32;
export const MAX_TAGS      = 10;

// ─── Storage key helpers ──────────────────────────────────────────────────────

function storeKey(walletPubkey: string): string {
  return `wraith:labels:${walletPubkey}`;
}
function noticeKey(walletPubkey: string): string {
  return `wraith:labels:${walletPubkey}:seen-privacy-notice`;
}

// ─── Low-level read / write ───────────────────────────────────────────────────

function readStore(walletPubkey: string): Record<string, StealthLabel> {
  if (!walletPubkey) return {};
  try {
    const raw = localStorage.getItem(storeKey(walletPubkey));
    return raw ? (JSON.parse(raw) as Record<string, StealthLabel>) : {};
  } catch {
    return {};
  }
}

function writeStore(walletPubkey: string, store: Record<string, StealthLabel>): void {
  if (!walletPubkey) return;
  try {
    localStorage.setItem(storeKey(walletPubkey), JSON.stringify(store));
  } catch {
    // localStorage full — silently ignore; labels are non-critical
  }
}

// ─── Sanitisation ─────────────────────────────────────────────────────────────

function sanitiseLabel(raw: string): string {
  return raw.trim().slice(0, LABEL_MAX_LEN);
}
function sanitiseTags(raw: string[]): string[] {
  return raw
    .map((t) => t.trim().slice(0, TAG_MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

// ─── Public CRUD API ──────────────────────────────────────────────────────────

/** Returns all labels for the wallet (including hidden ones). */
export function getAllLabels(walletPubkey: string): StealthLabel[] {
  return Object.values(readStore(walletPubkey));
}

/** Returns the label for a single stealth address, or null. */
export function getLabel(walletPubkey: string, stealthAddress: string): StealthLabel | null {
  return readStore(walletPubkey)[stealthAddress] ?? null;
}

/**
 * Creates or updates the label for `stealthAddress`.
 * Returns `{ saved, isFirstEver }` — `isFirstEver` triggers the privacy notice.
 */
export function upsertLabel(
  walletPubkey: string,
  stealthAddress: string,
  patch: Partial<Pick<StealthLabel, 'label' | 'tags'>>,
): { saved: StealthLabel; isFirstEver: boolean } {
  if (!walletPubkey) {
    return {
      saved: { stealthAddress, label: '', tags: [], createdAt: Date.now() },
      isFirstEver: false,
    };
  }
  const store      = readStore(walletPubkey);
  const existing   = store[stealthAddress];
  const isFirstEver = !hasSeenPrivacyNotice(walletPubkey) && Object.keys(store).length === 0;
  const updated: StealthLabel = {
    stealthAddress,
    label:    sanitiseLabel(patch.label ?? existing?.label ?? ''),
    tags:     sanitiseTags(patch.tags ?? existing?.tags ?? []),
    hiddenAt: existing?.hiddenAt,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  store[stealthAddress] = updated;
  writeStore(walletPubkey, store);
  return { saved: updated, isFirstEver };
}

/** Archives (hides) a label row. Remains in storage, excluded from default view. */
export function hideLabel(walletPubkey: string, stealthAddress: string): void {
  const store = readStore(walletPubkey);
  if (store[stealthAddress]) {
    store[stealthAddress] = { ...store[stealthAddress], hiddenAt: Date.now() };
    writeStore(walletPubkey, store);
  }
}

/** Restores an archived label. */
export function unhideLabel(walletPubkey: string, stealthAddress: string): void {
  const store = readStore(walletPubkey);
  if (store[stealthAddress]) {
    const { hiddenAt: _removed, ...rest } = store[stealthAddress];
    store[stealthAddress] = rest as StealthLabel;
    writeStore(walletPubkey, store);
  }
}

/** Hard-deletes a label entry. */
export function deleteLabel(walletPubkey: string, stealthAddress: string): void {
  const store = readStore(walletPubkey);
  delete store[stealthAddress];
  writeStore(walletPubkey, store);
}

// ─── Privacy notice flag ──────────────────────────────────────────────────────

export function hasSeenPrivacyNotice(walletPubkey: string): boolean {
  if (!walletPubkey) return true;
  return localStorage.getItem(noticeKey(walletPubkey)) === '1';
}
export function markPrivacyNoticeSeen(walletPubkey: string): void {
  if (!walletPubkey) return;
  localStorage.setItem(noticeKey(walletPubkey), '1');
}

// ─── Search + filter helpers ──────────────────────────────────────────────────

export interface LabelFilter {
  query?: string;       // substring match on label text, address, or tags
  tag?: string;         // exact tag match
  showHidden?: boolean; // default false
}

export function filterLabels(labels: StealthLabel[], filter: LabelFilter): StealthLabel[] {
  const { query = '', tag, showHidden = false } = filter;
  const q = query.toLowerCase();
  return labels.filter((l) => {
    if (!showHidden && l.hiddenAt !== undefined) return false;
    if (tag && !l.tags.includes(tag)) return false;
    if (q) {
      const hit =
        l.label.toLowerCase().includes(q) ||
        l.stealthAddress.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

/** Every unique tag across all visible labels for this wallet. */
export function getAllTags(walletPubkey: string): string[] {
  const all = getAllLabels(walletPubkey).filter((l) => !l.hiddenAt);
  const set = new Set<string>();
  all.forEach((l) => l.tags.forEach((t) => set.add(t)));
  return [...set].sort();
}

// ─── Export / Import ──────────────────────────────────────────────────────────

export interface LabelExport {
  version: 1;
  walletPubkey: string;
  exportedAt: number;
  labels: StealthLabel[];
}

/** Serialises all labels (including hidden) to a JSON string for download. */
export function exportLabels(walletPubkey: string): string {
  const payload: LabelExport = {
    version: 1,
    walletPubkey,
    exportedAt: Date.now(),
    labels: getAllLabels(walletPubkey),
  };
  return JSON.stringify(payload, null, 2);
}

export type ImportConflictStrategy = 'keep-existing' | 'overwrite' | 'merge-tags';

export interface ImportResult {
  imported: number;
  skipped: number;
  conflicts: number;
}

/**
 * Merges an exported JSON blob into the current wallet's store.
 *
 * Strategies:
 *   keep-existing — skip if address already labelled
 *   overwrite     — imported entry fully replaces existing
 *   merge-tags    — keep existing label text; union tag arrays
 */
export function importLabels(
  walletPubkey: string,
  jsonString: string,
  strategy: ImportConflictStrategy = 'keep-existing',
): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, conflicts: 0 };
  if (!walletPubkey) return result;
  let parsed: LabelExport;
  try {
    parsed = JSON.parse(jsonString) as LabelExport;
    if (parsed.version !== 1 || !Array.isArray(parsed.labels)) throw new Error();
  } catch {
    return result;
  }
  const store = readStore(walletPubkey);
  for (const incoming of parsed.labels) {
    if (!incoming.stealthAddress) continue;
    const addr     = incoming.stealthAddress;
    const existing = store[addr];
    if (existing) {
      result.conflicts++;
      if (strategy === 'keep-existing') {
        result.skipped++;
        continue;
      } else if (strategy === 'overwrite') {
        store[addr] = { ...incoming, label: sanitiseLabel(incoming.label), tags: sanitiseTags(incoming.tags) };
        result.imported++;
      } else {
        store[addr] = { ...existing, tags: sanitiseTags([...new Set([...existing.tags, ...incoming.tags])]) };
        result.imported++;
      }
    } else {
      store[addr] = { ...incoming, label: sanitiseLabel(incoming.label), tags: sanitiseTags(incoming.tags) };
      result.imported++;
    }
  }
  writeStore(walletPubkey, store);
  return result;
}