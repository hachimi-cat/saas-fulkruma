'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateTimePickerProps {
  /** Value in `datetime-local` shape: "YYYY-MM-DDTHH:mm" (or "" for empty). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}

function parseLocal(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePicker({
  value,
  onChange,
  id,
  placeholder = 'Pick a date & time',
}: DateTimePickerProps) {
  const date = parseLocal(value);
  const time = date ? format(date, 'HH:mm') : '';

  function commit(next: Date) {
    onChange(toLocalString(next));
  }

  function handleDate(picked?: Date) {
    if (!picked) {
      onChange('');
      return;
    }
    const base = date ?? new Date();
    const next = new Date(picked);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(next);
  }

  function handleTime(t: string) {
    const [h, m] = t.split(':').map(Number);
    const base = date ?? new Date();
    const next = new Date(base);
    next.setHours(h || 0, m || 0, 0, 0);
    commit(next);
  }

  return (
    <div className="relative">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full cursor-pointer justify-start gap-2 pr-9 font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {date ? format(date, "d MMM yyyy 'at' HH:mm") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleDate} autoFocus />
          <div className="border-t border-border p-3">
            <label
              htmlFor={id ? `${id}-time` : undefined}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Time
            </label>
            <Input
              id={id ? `${id}-time` : undefined}
              type="time"
              value={time}
              onChange={(e) => handleTime(e.target.value)}
              className="w-full"
            />
          </div>
        </PopoverContent>
      </Popover>
      {date && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear date"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
