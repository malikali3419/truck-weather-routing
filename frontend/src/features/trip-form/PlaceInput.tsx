import { useEffect, useId, useRef, useState } from "react";
import { useGeocode } from "../../api/hooks";
import type { Place } from "../../api/types";

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function PlaceInput({ label, placeholder, value, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text, 250);
  const typing = open && text !== value?.label;
  const { data: results = [], isFetching } = useGeocode(typing ? query : "");
  const wrapper = useRef<HTMLDivElement>(null);

  // Reflect places set from outside (sample trips).
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
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="field"
        placeholder={placeholder}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
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
      {isFetching && typing && (
        <span className="absolute right-3 top-[34px] h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      )}
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {results.length === 0 && <li className="px-3 py-2 text-slate-500">No matches</li>}
          {results.map((place, i) => (
            <li
              key={`${place.label}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-slate-100" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
