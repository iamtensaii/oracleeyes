"use client";

import { useCallback, useEffect, useState } from "react";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import {
  defaultSessionName,
  loadLastActiveId,
  loadSessions,
  persistLastActiveId,
  persistSessions,
  type StoredChartSession,
} from "@/lib/chart-sessions-storage";
import type { OhlcBar } from "@/types/market";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChartSessions() {
  const [sessions, setSessions] = useState<StoredChartSession[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
    setActiveIdState(loadLastActiveId());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistSessions(sessions);
  }, [sessions, hydrated]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    persistLastActiveId(id);
  }, []);

  const getSession = useCallback(
    (id: string) => sessions.find((s) => s.id === id) ?? null,
    [sessions],
  );

  const saveSnapshot = useCallback(
    (bars: OhlcBar[], meta: CsvDatasetMeta | null, name?: string) => {
      if (!bars.length) return null;
      const now = Date.now();
      const id = newId();
      const session: StoredChartSession = {
        id,
        name: name?.trim() || defaultSessionName(meta, bars.length),
        createdAt: now,
        updatedAt: now,
        bars,
        meta,
      };
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== id)]);
      setActiveId(id);
      return id;
    },
    [setActiveId],
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setActiveIdState((cur) => {
        if (cur === id) {
          persistLastActiveId(null);
          return null;
        }
        return cur;
      });
    },
    [],
  );

  const renameSession = useCallback((id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: n, updatedAt: Date.now() } : s)),
    );
  }, []);

  return {
    hydrated,
    sessions,
    activeId,
    setActiveId,
    getSession,
    saveSnapshot,
    deleteSession,
    renameSession,
  };
}
