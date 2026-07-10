const NAV_ORDER_KEY = "macropad:navOrder";

export interface NavOrderState {
  a: string[]; // News + indicator panels
  b: string[]; // Macro Bias / Replay / Fingerprint / Calendar
}

/** Reconciles a stored order with the current default: keeps stored positions for ids that still exist, appends any new ids (future panels) at the end, drops stale ones. */
function reconcile(stored: string[] | undefined, current: string[]): string[] {
  if (!stored) return current;
  const known = new Set(current);
  const kept = stored.filter((id) => known.has(id));
  const missing = current.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export function loadNavOrder(defaultA: string[], defaultB: string[]): NavOrderState {
  if (typeof window === "undefined") return { a: defaultA, b: defaultB };
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<NavOrderState>) : undefined;
    return { a: reconcile(parsed?.a, defaultA), b: reconcile(parsed?.b, defaultB) };
  } catch {
    return { a: defaultA, b: defaultB };
  }
}

export function saveNavOrder(order: NavOrderState) {
  try {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
  } catch {
    // localStorage unavailable - order just won't persist
  }
}

export function moveItem(order: string[], id: string, dir: -1 | 1): string[] {
  const idx = order.indexOf(id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= order.length) return order;
  const copy = order.slice();
  [copy[idx], copy[target]] = [copy[target], copy[idx]];
  return copy;
}
