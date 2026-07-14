"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_ACCENTS,
  DEFAULT_ADMIN_ACCENT,
  applyAdminAccent,
  isAdminAccentId,
  readStoredAdminAccent,
  type AdminAccentId,
} from "@/lib/admin-accent";

export function useAdminAccent() {
  const [accent, setAccentState] = useState<AdminAccentId>(DEFAULT_ADMIN_ACCENT);

  useEffect(() => {
    const stored = readStoredAdminAccent();
    setAccentState(stored);
    applyAdminAccent(stored);
  }, []);

  const setAccent = useCallback((next: AdminAccentId) => {
    if (!isAdminAccentId(next)) return;
    setAccentState(next);
    applyAdminAccent(next);
  }, []);

  return { accent, setAccent, accents: ADMIN_ACCENTS };
}
