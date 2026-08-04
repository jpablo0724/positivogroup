import { useEffect, useRef, useState } from "react";

export const selectTriggerClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  extraOptionLabel?: string;
  onExtraOption?: () => void;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Buscar...",
  extraOptionLabel,
  onExtraOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );

  function select(option: string) {
    onChange(option);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${selectTriggerClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${value ? "" : "text-slate-400"}`}>
          {value || placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-slate-400"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-1.5">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
          <ul className="max-h-48 overflow-auto py-1 text-sm">
            {filtered.length === 0 && (
              <li className="px-3 py-1.5 text-xs text-slate-400">
                Sin resultados
              </li>
            )}
            {filtered.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => select(option)}
                  className={`block w-full px-3 py-1.5 text-left ${
                    option === value
                      ? "bg-emerald-50 font-medium text-emerald-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {option}
                </button>
              </li>
            ))}
            {extraOptionLabel && onExtraOption && (
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onExtraOption();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="block w-full px-3 py-1.5 text-left text-emerald-600 hover:bg-emerald-50"
                >
                  {extraOptionLabel}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
