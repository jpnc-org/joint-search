import { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FileText, Tag } from 'lucide-react';
import api from '@/api/client';
import type { MentionItem } from '@/types';
import { cn } from '@/lib/utils';

interface MentionPopoverProps {
  open: boolean;
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export function MentionPopover({ open, query, onSelect, onClose }: MentionPopoverProps) {
  const [items, setItems] = useState<MentionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/mentions', { params: { q: query } });
        setItems(data);
        setActiveIndex(0);
      } catch {
        setItems([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter' && items.length > 0) {
      e.preventDefault();
      onSelect(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [open, items, activeIndex, onSelect, onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const icon = (type: MentionItem['type']) => {
    switch (type) {
      case 'knowledge-base': return <Folder className="size-3.5 shrink-0 text-blue-400" />;
      case 'tag': return <Tag className="size-3.5 shrink-0 text-green-400" />;
      case 'file': return <FileText className="size-3.5 shrink-0 text-purple-400" />;
    }
  };

  const label = (type: MentionItem['type']) => {
    switch (type) {
      case 'knowledge-base': return 'KB';
      case 'tag': return 'Tag';
      case 'file': return 'File';
    }
  };

  return (
    <div
      className="absolute z-50 w-80 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-md"
      style={{ bottom: '100%', left: 0, marginBottom: 8 }}
      ref={listRef}
    >
      {items.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground">No results found.</div>
      )}
      {items.map((item, i) => (
        <button
          key={`${item.type}-${item.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => setActiveIndex(i)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer",
            i === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground"
          )}
        >
          {icon(item.type)}
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{item.path}</div>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">{label(item.type)}</span>
        </button>
      ))}
    </div>
  );
}
