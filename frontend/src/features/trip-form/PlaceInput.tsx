import { MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useGeocode } from "../../api/hooks";
import type { Place } from "../../api/types";
import { Spinner } from "../../components/ui";

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  icon: ReactNode;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function PlaceInput({ label, placeholder, value, onChange, icon }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text, 250);
  const typing = open && text !== value?.label;
  const { data: results = [], isFetching } = useGeocode(typing ? query : "");
  const wrapper = useRef<HTMLDivElement>(null);

  // Reflect places set from outside (sample trips, swap).
  useEffect(() => {
    if (value) setText(value.label);
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (place: Place) => {
    onChange(place);
    setText(place.label);
    setOpen(false);
  };

  const showList = typing && text.trim().length >= 3 && (results.length > 0 || !isFetching);

  return (
    <div ref={wrapper} className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
      <input
        id={id}
        className="field pl-9 pr-9"
        placeholder={placeholder}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {isFetching && typing && <Spinner className="absolute right-3 top-3 h-4 w-4 text-sky-600 dark:text-sky-400" />}
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="scrollbar-thin absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-overlay/10 bg-ink-850/95 p-1 text-sm shadow-glass backdrop-blur-xl"
        >
          {results.length === 0 && <li className="px-3 py-2 text-muted">No matches</li>}
          {results.map((place, i) => (
            <li
              key={`${place.label}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 ${i === active ? "bg-sky-400/10 text-fg" : "text-fg-2"}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="truncate">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
