'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { SearchEntry } from '@/lib/markdown';

interface DocsSearchProps {
  index: SearchEntry[];
}

interface Hit {
  entry: SearchEntry;
  score: number;
  snippet: string;
}

// Lightweight client-side fuzzy search. Tokens in the query must all
// appear (case-insensitive) somewhere in the entry's title or body.
// Title matches score higher than body matches; multiple matches in
// the same field add up. Snippet shows the first body match in context.
function search(index: SearchEntry[], query: string, limit = 8): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return [];

  const hits: Hit[] = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    const body = entry.body.toLowerCase();
    let score = 0;
    let firstBodyHit = -1;

    for (const tok of tokens) {
      const titleHits = countOccurrences(title, tok);
      const bodyHits = countOccurrences(body, tok);
      if (titleHits === 0 && bodyHits === 0) {
        score = -1;
        break;
      }
      score += titleHits * 10 + bodyHits;
      if (bodyHits > 0 && firstBodyHit < 0) {
        firstBodyHit = body.indexOf(tok);
      }
    }
    if (score <= 0) continue;

    // Boost exact-phrase matches in the title.
    if (title.includes(q)) score += 50;

    hits.push({ entry, score, snippet: makeSnippet(entry.body, firstBodyHit, q) });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

function makeSnippet(body: string, hitAt: number, query: string): string {
  if (hitAt < 0) return body.slice(0, 140).trim() + '…';
  const start = Math.max(0, hitAt - 50);
  const end = Math.min(body.length, hitAt + 140);
  const prefix = start === 0 ? '' : '…';
  const suffix = end === body.length ? '' : '…';
  return prefix + body.slice(start, end).trim() + suffix;
}

export function DocsSearch({ index }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => search(index, query), [index, query]);

  // ⌘K / Ctrl+K focuses the search.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Click-outside dismiss.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => setActiveIndex(0), [query]);

  function onArrow(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) window.location.href = hit.entry.href;
    }
  }

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onArrow}
          placeholder="Search docs"
          className="w-full rounded-md border border-border bg-background px-3 py-2 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search documentation"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length > 1 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {hits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="py-1" role="listbox">
              {hits.map((hit, i) => (
                <li key={hit.entry.href} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={hit.entry.href}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={
                      'block px-4 py-2 text-sm ' +
                      (i === activeIndex ? 'bg-muted' : 'hover:bg-muted/60')
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{hit.entry.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {hit.entry.group}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {hit.snippet}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
