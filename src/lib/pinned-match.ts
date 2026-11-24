"use client";

// The match a fan has pinned to their screen (one at a time, like Google's pinned score). Kept in this
// browser only (localStorage): a per-viewer preference, never sent anywhere. Every access is wrapped,
// so private windows or blocked storage simply mean "nothing pinned".
import { useSyncExternalStore } from "react";

const KEY = "cst-pinned-match";
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function setPinnedMatch(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(id));
  } catch {
    // Storage unavailable: the pin lasts until the page reloads.
    memory = id;
  }
  emit();
}

let memory: number | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab pinned or unpinned a match.
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The pinned match id, or null. Null during server rendering (the chip appears after hydration). */
export function usePinnedMatch(): number | null {
  return useSyncExternalStore(subscribe, () => read() ?? memory, () => null);
}
