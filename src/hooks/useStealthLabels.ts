/**
 * useStealthLabels.ts
 *
 * React hook that wraps stealth-labels.ts with local React state so
 * components re-render on every label mutation without prop-drilling.
 *
 * Usage:
 *   const labels = useStealthLabels(walletPubkey);
 *   labels.upsert(stealthAddress, { label: 'Rent – May' });
 *   labels.filtered   // StealthLabel[] after search/tag/hidden filter
 *   labels.allTags    // string[] of every tag across all visible labels
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteLabel,
  exportLabels,
  filterLabels,
  getAllLabels,
  getAllTags,
  hasSeenPrivacyNotice,
  hideLabel,
  importLabels,
  LabelFilter,
  markPrivacyNoticeSeen,
  StealthLabel,
  upsertLabel,
  unhideLabel,
  type ImportConflictStrategy,
  type ImportResult,
} from '@/lib/stealth-labels';

export interface UseStealthLabels {
  /** All labels (raw, unfiltered, includes hidden). */
  all: StealthLabel[];
  /** Labels after applying the current filter. */
  filtered: StealthLabel[];
  /** Every unique tag across visible labels. */
  allTags: string[];
  /** Current active filter. */
  filter: LabelFilter;
  /** Update search query, active tag, or showHidden flag. */
  setFilter: (patch: Partial<LabelFilter>) => void;
  /** Create or update a label. Returns true if privacy notice should be shown. */
  upsert: (stealthAddress: string, patch: Partial<Pick<StealthLabel, 'label' | 'tags'>>) => boolean;
  /** Archive a row (remove from default view). */
  hide: (stealthAddress: string) => void;
  /** Restore an archived row. */
  unhide: (stealthAddress: string) => void;
  /** Hard-delete a label entry. */
  remove: (stealthAddress: string) => void;
  /** Trigger a JSON file download of all labels. */
  exportToFile: () => void;
  /**
   * Import from a JSON string (e.g. after FileReader.readAsText).
   * Returns import stats; caller can show a summary.
   */
  importFromJson: (json: string, strategy?: ImportConflictStrategy) => ImportResult;
  /** Whether the wallet has any labels at all. */
  isEmpty: boolean;
  /** Whether there are any hidden labels (so UI can offer "show hidden" toggle). */
  hasHidden: boolean;
}

export function useStealthLabels(walletPubkey: string): UseStealthLabels {
  const [all, setAll] = useState<StealthLabel[]>(() => getAllLabels(walletPubkey));
  const [filter, setFilterState] = useState<LabelFilter>({ showHidden: false });

  // Reload when wallet changes
  useEffect(() => {
    setAll(getAllLabels(walletPubkey));
    setFilterState({ showHidden: false });
  }, [walletPubkey]);

  // Derived
  const filtered = useMemo(() => filterLabels(all, filter), [all, filter]);
  const allTags  = useMemo(() => getAllTags(walletPubkey), [all, walletPubkey]);
  const isEmpty  = all.length === 0;
  const hasHidden = all.some((l) => l.hiddenAt !== undefined);

  const refresh = useCallback(() => {
    setAll(getAllLabels(walletPubkey));
  }, [walletPubkey]);

  const setFilter = useCallback((patch: Partial<LabelFilter>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  }, []);

  const upsert = useCallback(
    (stealthAddress: string, patch: Partial<Pick<StealthLabel, 'label' | 'tags'>>) => {
      const { isFirstEver } = upsertLabel(walletPubkey, stealthAddress, patch);
      if (isFirstEver) markPrivacyNoticeSeen(walletPubkey);
      refresh();
      return isFirstEver;
    },
    [walletPubkey, refresh],
  );

  const hide = useCallback(
    (stealthAddress: string) => {
      hideLabel(walletPubkey, stealthAddress);
      refresh();
    },
    [walletPubkey, refresh],
  );

  const unhide = useCallback(
    (stealthAddress: string) => {
      unhideLabel(walletPubkey, stealthAddress);
      refresh();
    },
    [walletPubkey, refresh],
  );

  const remove = useCallback(
    (stealthAddress: string) => {
      deleteLabel(walletPubkey, stealthAddress);
      refresh();
    },
    [walletPubkey, refresh],
  );

  const exportToFile = useCallback(() => {
    const json     = exportLabels(walletPubkey);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `wraith-labels-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [walletPubkey]);

  const importFromJson = useCallback(
    (json: string, strategy: ImportConflictStrategy = 'keep-existing') => {
      const result = importLabels(walletPubkey, json, strategy);
      refresh();
      return result;
    },
    [walletPubkey, refresh],
  );

  return {
    all,
    filtered,
    allTags,
    filter,
    setFilter,
    upsert,
    hide,
    unhide,
    remove,
    exportToFile,
    importFromJson,
    isEmpty,
    hasHidden,
  };
}