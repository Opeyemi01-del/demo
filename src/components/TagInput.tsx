/**
 * TagInput.tsx
 *
 * Inline chip-style tag editor. Shown inside StealthLabelRow when the tag
 * edit button is clicked. Renders existing tags as removable chips, plus a
 * text input for adding new ones.
 *
 * Keyboard flow:
 *   Enter or comma → add the current input as a new tag
 *   Backspace on empty input → remove the last tag
 *   Escape → cancel without saving
 */

import { useEffect, useRef, useState } from 'react';
import { MAX_TAGS, TAG_MAX_LEN } from '@/lib/stealth-labels';

interface Props {
  initialTags: string[];
  onSave: (tags: string[]) => void;
  onCancel: () => void;
}

export function TagInput({ initialTags, onSave, onCancel }: Props) {
  const [tags, setTags]     = useState<string[]>(initialTags);
  const [input, setInput]   = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function addTag(raw: string) {
    const cleaned = raw.trim().slice(0, TAG_MAX_LEN);
    if (!cleaned || tags.includes(cleaned) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, cleaned]);
    setInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Chips + input */}
      <div className="flex flex-wrap items-center gap-1 min-h-[28px] border border-[#333333] px-2 py-1 focus-within:border-[#555555] transition-colors">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-0.5 px-1.5 py-0 text-[10px] border border-[#444444] text-[#c4c7c5]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-[#555555] hover:text-[#ee7d77] ml-0.5 leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, TAG_MAX_LEN))}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(input)}
            placeholder={tags.length === 0 ? 'Add tags (Enter to confirm)…' : ''}
            className="flex-1 min-w-[80px] bg-transparent text-xs text-[#e6e1e5] placeholder:text-[#333333] focus:outline-none"
          />
        )}
      </div>

      {/* Save / cancel */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(tags)}
          className="text-xs text-[#22c55e] hover:brightness-110 transition-[filter]"
        >
          Save tags
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#555555] hover:text-[#767575] transition-colors"
        >
          Cancel
        </button>
        <span className="text-[10px] text-[#333333] ml-auto self-center">
          {tags.length}/{MAX_TAGS}
        </span>
      </div>
    </div>
  );
}