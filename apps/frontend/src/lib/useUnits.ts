import { useMemo } from "react";
import { api } from "./api";
import { useApiData } from "./useApiData";

export interface UnitOption {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  /** "Main › Batch A" — the unit's name prefixed by its ancestors, so two "Section A"s are tellable apart. */
  label: string;
}

interface RawUnit {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

/** Every active group in the institute, flattened and labelled with its ancestry, in tree order. */
export function useUnits() {
  const { data, loading, error } = useApiData<RawUnit[]>(() => api.get<RawUnit[]>("/api/structure/units"));

  const units = useMemo<UnitOption[]>(() => {
    if (!data) return [];
    const byId = new Map(data.map((u) => [u.id, u]));
    const labelOf = (u: RawUnit): string => {
      const parent = u.parentId ? byId.get(u.parentId) : undefined;
      return parent ? `${labelOf(parent)} › ${u.name}` : u.name;
    };
    return data.map((u) => ({ ...u, label: labelOf(u) })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [data]);

  return { units, loading, error };
}
