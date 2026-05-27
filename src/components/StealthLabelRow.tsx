/**
 * StealthLabelRow.tsx
 *
 * One row in the stealth-address list on the Receive page.
 * Shows: truncated address | editable label | tag chips | hide button
 *
 * Interaction contract:
 *   • Click pencil → text input appears, focused.
 *   • Blur or Enter → save.
 *   • Escape → cancel (revert to previous value).
 *   • Tag chips are rendered below the label; clicking one fires `onTagClick`.
 *   • "Archive" (eye-off icon) calls `onHide`.
 *   • Hidden rows rendered in muted style with "restore" icon when
 *     `showHidden` is true.
 */

import { useEffect, useRef, useState } from 'react';
import type { StealthLabel } from '@/lib/stealth-labels';
import { LABEL_MAX_LEN } from '@/lib/stealth-labels';
import { TagInput } from './TagInput';

interface Props {
  entry: StealthLabel;
  activeTag?: string;
  onSave: (stealthAddress: string, patch: Partial<Pick<StealthLabel, 'label' | 'tags'>>) => void;
  onHide: (stealthAddress: string) => void;
  onUnhide: (stealthAddress: string) => void;
  onTagClick: (tag: string) => void;
}

function truncate(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

export function StealthLabelRow({
  entry,
  activeTag,
  onSave,
  onHide,
  onUnhide,
  onTagClick,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(entry.label);
  const [editTags, setEditTags] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHidden = entry.hiddenAt !== undefined;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Keep draft in sync if parent re-renders with a newer value while not editing
  useEffect(() => {
    if (!editing) setDraft(entry.label);
  }, [entry.label, editing]);

  function commitLabel() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== entry.label) {
      onSave(entry.stealthAddress, { label: trimmed });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  { commitLabel(); }
    if (e.key === 'Escape') { setDraft(entry.label); setEditing(false); }
  }

  function saveTags(tags: string[]) {
    onSave(entry.stealthAddress, { tags });
    setEditTags(false);
  }

  return (
    <div
      className={[
        'group flex flex-col gap-1 px-3 py-2.5 border-b border-[#2a2a2a] transition-opacity',
        isHidden ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      {/* ── Top row: address + label + actions ── */}
      <div className="flex items-center gap-2 min-w-0">

        {/* Stealth address (truncated, monospace) */}
        <span
          className="font-mono text-xs text-[#767575] shrink-0 select-all"
          title={entry.stealthAddress}
        >
          {truncate(entry.stealthAddress)}
        </span>

        {/* Label — view or edit mode */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, LABEL_MAX_LEN))}
              onBlur={commitLabel}
              onKeyDown={handleKeyDown}
              maxLength={LABEL_MAX_LEN}
              placeholder="Add a label…"
              className={[
                'w-full bg-transparent border-b border-[#444444] text-sm text-[#e6e1e5]',
                'placeholder:text-[#444444] focus:outline-none focus:border-[#c6c6c7] py-0.5',
              ].join(' ')}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={[
                'flex items-center gap-1.5 text-sm text-left w-full',
                entry.label ? 'text-[#e6e1e5]' : 'text-[#444444] italic',
                'hover:text-[#c6c6c7] transition-colors',
              ].join(' ')}
              title="Click to edit label"
            >
              <span className="truncate">
                {entry.label || 'Add label…'}
              </span>
              {/* Pencil — appears on row hover */}
              <svg
                className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                width="12" height="12" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11.5 2.5a2.121 2.121 0 1 1 3 3L5 15H2v-3L11.5 2.5Z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Action buttons — always visible */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Tags toggle */}
          <button
            onClick={() => setEditTags((v) => !v)}
            title="Edit tags"
            className="p-1 text-[#444444] hover:text-[#c6c6c7] transition-colors"
            aria-label="Edit tags"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M2 4h12M4 8h8M6 12h4"/>
            </svg>
          </button>

          {/* Hide / restore */}
          {isHidden ? (
            <button
              onClick={() => onUnhide(entry.stealthAddress)}
              title="Restore"
              className="p-1 text-[#444444] hover:text-[#22c55e] transition-colors"
              aria-label="Restore hidden entry"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <ellipse cx="8" cy="8" rx="6" ry="4"/>
                <circle cx="8" cy="8" r="1.5"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => onHide(entry.stealthAddress)}
              title="Archive (hide)"
              className="p-1 text-[#444444] hover:text-[#767575] transition-colors"
              aria-label="Archive this entry"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <ellipse cx="8" cy="8" rx="6" ry="4"/>
                <line x1="3" y1="3" x2="13" y2="13"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Tag chips ── */}
      {entry.tags.length > 0 && !editTags && (
        <div className="flex flex-wrap gap-1 pl-[calc(6ch+0.5rem)]">
          {entry.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className={[
                'px-1.5 py-0 text-[10px] rounded-sm border transition-colors',
                activeTag === tag
                  ? 'border-[#c6c6c7] text-[#e6e1e5] bg-[#2a2a2a]'
                  : 'border-[#333333] text-[#767575] hover:border-[#555555] hover:text-[#c4c7c5]',
              ].join(' ')}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Tag editor (inline) ── */}
      {editTags && (
        <div className="pl-[calc(6ch+0.5rem)]">
          <TagInput
            initialTags={entry.tags}
            onSave={saveTags}
            onCancel={() => setEditTags(false)}
          />
        </div>
      )}
    </div>
  );
}