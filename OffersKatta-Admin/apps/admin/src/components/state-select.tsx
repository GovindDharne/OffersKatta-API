'use client';

/// StateSelect — Indian states + union territories, backed by the State master
/// (GET /states). Value is the state *name* string.
///
/// Implemented as a NATIVE <select>: the option list is rendered by the OS, so
/// it never gets clipped or click-blocked inside dialogs / overflow containers
/// (a custom popover hit exactly that problem). Native typeahead lets you jump
/// to a state by typing its first letters.

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface State {
  id: string;
  name: string;
  code: string | null;
  isUnionTerritory: boolean;
}

export function StateSelect({
  value,
  onChange,
  placeholder = 'Select state',
  id,
}: {
  value?: string;
  onChange: (stateName: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const statesQ = useQuery({ queryKey: ['states'], queryFn: () => apiGet<State[]>('/states') });
  const states = statesQ.data ?? [];
  const mainStates = states.filter((s) => !s.isUnionTerritory);
  const uts = states.filter((s) => s.isUnionTerritory);

  // If the current value isn't in the fetched list (e.g. legacy free-text data),
  // keep it selectable so the field doesn't silently blank out.
  const valueMissing = Boolean(value) && !states.some((s) => s.name === value);

  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>
        {statesQ.isLoading ? 'Loading…' : placeholder}
      </option>
      {valueMissing ? <option value={value}>{value}</option> : null}
      {mainStates.length > 0 ? (
        <optgroup label="States">
          {mainStates.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </optgroup>
      ) : null}
      {uts.length > 0 ? (
        <optgroup label="Union Territories">
          {uts.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
