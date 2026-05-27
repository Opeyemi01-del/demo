/**
 * ImportConflictModal.tsx
 *
 * Shown when the user imports a JSON file that contains addresses already in
 * their label store. Offers three resolution strategies:
 *   keep-existing — skip conflicting entries
 *   overwrite     — replace with imported values
 *   merge-tags    — keep label text, union tag arrays
 */

import type { ImportConflictStrategy } from '@/lib/stealth-labels';

interface Props {
  conflictCount: number;
  onResolve: (strategy: ImportConflictStrategy) => void;
  onCancel: () => void;
}

const STRATEGIES: { value: ImportConflictStrategy; label: string; description: string }[] = [
  {
    value: 'keep-existing',
    label: 'Keep mine',
    description: 'Ignore imported entries that conflict with existing labels.',
  },
  {
    value: 'overwrite',
    label: 'Overwrite',
    description: 'Replace existing labels with the imported versions.',
  },
  {
    value: 'merge-tags',
    label: 'Merge tags',
    description: 'Keep existing label text, but combine both sets of tags.',
  },
];

export function ImportConflictModal({ conflictCount, onResolve, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Import conflict resolution"
    >
      <div className="bg-[#141414] border border-[#333333] w-full max-w-sm p-5 space-y-4">
        <h2 className="text-sm font-medium text-[#e6e1e5]">
          {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} found
        </h2>
        <p className="text-xs text-[#767575] leading-relaxed">
          Some imported addresses already have labels. How should conflicts be resolved?
        </p>

        <div className="space-y-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              onClick={() => onResolve(s.value)}
              className={[
                'w-full text-left px-3 py-2.5 border border-[#2a2a2a]',
                'hover:border-[#444444] transition-colors space-y-0.5',
              ].join(' ')}
            >
              <p className="text-xs font-medium text-[#e6e1e5]">{s.label}</p>
              <p className="text-[11px] text-[#555555]">{s.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full text-xs text-[#444444] hover:text-[#767575] transition-colors pt-1"
        >
          Cancel import
        </button>
      </div>
    </div>
  );
}