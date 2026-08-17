import type { Endpoint } from "./model";
import { endpointKey } from "./model";
import { filterEndpoints, groupByTag } from "./tree";

const host = window.__TRAWL__!;
const { useMemo, useState } = host.react;
const { MethodBadge } = host.ui;

export function EndpointTree({
  endpoints,
  selected,
  onSelect,
  stats,
}: {
  endpoints: Endpoint[];
  selected: Endpoint | null;
  onSelect: (e: Endpoint) => void;
  stats?: (e: Endpoint) => { calls: number; violations: number } | undefined;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupByTag(filterEndpoints(endpoints, query)), [endpoints, query]);

  return (
    <div className="text-sm">
      <input
        className="w-full bg-transparent border-b border-border px-3 py-2 text-xs outline-none"
        placeholder="Search endpoints"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nothing matches.</p>}
      {groups.map((group) => (
        <div key={group.tag}>
          <button
            className="w-full text-left px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground"
            onClick={() => setCollapsed((c) => ({ ...c, [group.tag]: !c[group.tag] }))}
          >
            {collapsed[group.tag] ? "▸" : "▾"} {group.tag}
            <span className="ml-1 opacity-60">{group.endpoints.length}</span>
          </button>
          {!collapsed[group.tag] &&
            group.endpoints.map((e) => {
              const key = endpointKey(e);
              const isSelected = selected != null && endpointKey(selected) === key;
              return (
                <button
                  key={`${group.tag}:${key}`}
                  onClick={() => onSelect(e)}
                  className={`w-full text-left pl-5 pr-3 py-1 flex items-center gap-2 ${
                    isSelected ? "bg-accent" : "hover:bg-accent/40"
                  }`}
                  title={e.summary ?? key}
                >
                  <MethodBadge method={e.method} />
                  <span className="truncate font-mono text-xs">{e.pathTemplate}</span>
                  {(() => {
                    const s = stats?.(e);
                    if (!s || s.calls === 0) return null;
                    return (
                      <span
                        className={`ml-auto text-[10px] ${
                          s.violations > 0 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {s.calls}
                      </span>
                    );
                  })()}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
