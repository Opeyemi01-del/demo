/**
 * StealthLabelPanel.tsx
 *
 * Self-contained label management panel for the Receive page.
 * Composes all sub-components: search bar, tag filter chips, label rows,
 * show-hidden toggle, and import/export controls.
 *
 * Designed to sit below the scan results list in StellarReceive.tsx.
 *
 * Props:
 *   walletPubkey    — connected wallet's public key; empty string = no-op
 *   stealthEntries  — the raw scan matches from the existing Receive page so
 *                     we can pre-populate rows for addresses that have no label yet
 *
 * The panel deliberately does NOT receive the viewing key or spending key —
 * labels are purely organisational metadata; no cryptographic material flows
 * through here.
 */

import { useCallback, useRef, useState } from 'react';
import { useStealthLabels } from '@/hooks/useStealthLabels';
import { StealthLabelRow } from './StealthLabelRow';
import { PrivacyNoticeTooltip } from './PrivacyNoticeTooltip';
import { ImportConflictModal } from './ImportConflictModal';
import type { ImportConflictStrategy, StealthLabel } from '@/lib/stealth-labels';
import { markPrivacyNoticeSeen, hasSeenPrivacyNotice } from '@/lib/stealth-labels';

interface StealthEntry {
  stealthAddress: string;
  amount?: string;
  txHash?: string;
}

interface Props {
  walletPubkey: string;
  stealthEntries: StealthEntry[];
}

export function StealthLabelPanel({ walletPubkey, stealthEntries }: Props) {
  const labels = useStealthLabels(walletPubkey);

  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [importResult, setImportResult]           = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build a unified list: labelled entries first (sorted by createdAt desc),
  // then unlabelled scan results that have no label entry yet.
  const labelledAddresses = new Set(labels.all.map((l) => l.stealthAddress));
  const unlabelledEntries = stealthEntries.filter(
    (e) => !labelledAddresses.has(e.stealthAddress),
  );

  // Merged view for display — filtered labelled rows + unlabelled scan hits
  const visibleRows = labels.filtered;
  const allRowCount = labels.all.length + unlabelledEntries.length;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    (stealthAddress: string, patch: Partial<Pick<StealthLabel, 'label' | 'tags'>>) => {
      const isFirstEver = labels.upsert(stealthAddress, patch);
      if (isFirstEver) setShowPrivacyNotice(true);
    },
    [labels],
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      labels.setFilter({ tag: labels.filter.tag === tag ? undefined : tag });
    },
    [labels],
  );

  // ── Import / export ───────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      // Quick pre-parse to count conflicts
      try {
        const parsed = JSON.parse(json);
        const conflictCount = (parsed.labels as StealthLabel[]).filter(
          (l) => labels.all.some((existing) => existing.stealthAddress === l.stealthAddress),
        ).length;
        if (conflictCount > 0) {
          setPendingImportJson(json);
        } else {
          const result = labels.importFromJson(json, 'keep-existing');
          setImportResult({ imported: result.imported, skipped: result.skipped });
        }
      } catch {
        setImportResult({ imported: 0, skipped: 0 });
      }
      // Reset file input so the same file can be re-selected
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function resolveConflict(strategy: ImportConflictStrategy) {
    if (!pendingImportJson) return;
    const result = labels.importFromJson(pendingImportJson, strategy);
    setImportResult({ imported: result.imported, skipped: result.skipped });
    setPendingImportJson(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 border border-[#2a2a2a]">

      {/* ── Header bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a2a]">
        <span className="text-xs font-medium text-[#767575] uppercase tracking-wide">
          Labels
        </span>
        {allRowCount > 0 && (
          <span className="text-[10px] text-[#444444]">
            {allRowCount} address{allRowCount !== 1 ? 'es' : ''}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Export */}
          <button
            onClick={labels.exportToFile}
            disabled={labels.isEmpty}
            className="text-[11px] text-[#444444] hover:text-[#767575] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Export labels as JSON"
          >
            Export
          </button>
          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-[#444444] hover:text-[#767575] transition-colors"
            title="Import labels from JSON"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Import labels file"
          />
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="px-3 py-2 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <svg
            className="text-[#333333] shrink-0" width="12" height="12" viewBox="0 0 16 16"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="4.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14"/>
          </svg>
          <input
            type="search"
            value={labels.filter.query ?? ''}
            onChange={(e) => labels.setFilter({ query: e.target.value })}
            placeholder="Search by label, address, or tag…"
            className={[
              'flex-1 bg-transparent text-xs text-[#e6e1e5]',
              'placeholder:text-[#333333] focus:outline-none',
            ].join(' ')}
            aria-label="Search labels"
          />
          {labels.filter.query && (
            <button
              onClick={() => labels.setFilter({ query: '' })}
              className="text-[#333333] hover:text-[#767575] transition-colors text-xs"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Tag filter chips ── */}
      {labels.allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-[#1e1e1e]">
          {labels.allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={[
                'px-1.5 py-0 text-[10px] rounded-sm border transition-colors',
                labels.filter.tag === tag
                  ? 'border-[#c6c6c7] text-[#e6e1e5] bg-[#2a2a2a]'
                  : 'border-[#2a2a2a] text-[#555555] hover:border-[#444444] hover:text-[#767575]',
              ].join(' ')}
            >
              {tag}
            </button>
          ))}
          {labels.filter.tag && (
            <button
              onClick={() => labels.setFilter({ tag: undefined })}
              className="px-1.5 py-0 text-[10px] text-[#444444] hover:text-[#767575] transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* ── Label rows ── */}
      <div className="max-h-[480px] overflow-y-auto">

        {/* Labelled rows (filtered) */}
        {visibleRows.map((entry) => (
          <StealthLabelRow
            key={entry.stealthAddress}
            entry={entry}
            activeTag={labels.filter.tag}
            onSave={handleSave}
            onHide={labels.hide}
            onUnhide={labels.unhide}
            onTagClick={handleTagClick}
          />
        ))}

        {/* Unlabelled scan entries — shown without filter so user can label them */}
        {unlabelledEntries.map((entry) => (
          <StealthLabelRow
            key={entry.stealthAddress}
            entry={{
              stealthAddress: entry.stealthAddress,
              label: '',
              tags: [],
              createdAt: Date.now(),
            }}
            activeTag={labels.filter.tag}
            onSave={handleSave}
            onHide={labels.hide}
            onUnhide={labels.unhide}
            onTagClick={handleTagClick}
          />
        ))}

        {/* Empty state */}
        {visibleRows.length === 0 && unlabelledEntries.length === 0 && (
          <p className="px-3 py-4 text-xs text-[#333333] text-center">
            {labels.filter.query || labels.filter.tag
              ? 'No labels match this filter.'
              : 'No stealth addresses yet. Scan to find payments.'}
          </p>
        )}
      </div>

      {/* ── Footer: hidden toggle + import feedback ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1e1e1e]">
        {labels.hasHidden && (
          <button
            onClick={() => labels.setFilter({ showHidden: !labels.filter.showHidden })}
            className="text-[11px] text-[#444444] hover:text-[#767575] transition-colors"
          >
            {labels.filter.showHidden ? 'Hide archived' : 'Show archived'}
          </button>
        )}

        {importResult && (
          <span className="text-[10px] text-[#555555] ml-auto">
            Imported {importResult.imported}
            {importResult.skipped > 0 ? `, skipped ${importResult.skipped}` : ''}
          </span>
        )}
      </div>

      {/* ── Privacy notice tooltip (one-time) ── */}
      {showPrivacyNotice && (
        <PrivacyNoticeTooltip
          onDismiss={() => {
            setShowPrivacyNotice(false);
            markPrivacyNoticeSeen(walletPubkey);
          }}
        />
      )}

      {/* ── Import conflict modal ── */}
      {pendingImportJson && (
        <ImportConflictModal
          conflictCount={
            (() => {
              try {
                const p = JSON.parse(pendingImportJson);
                return (p.labels as StealthLabel[]).filter((l) =>
                  labels.all.some((e) => e.stealthAddress === l.stealthAddress),
                ).length;
              } catch {
                return 0;
              }
            })()
          }
          onResolve={resolveConflict}
          onCancel={() => setPendingImportJson(null)}
        />
      )}
    </div>
  );
}