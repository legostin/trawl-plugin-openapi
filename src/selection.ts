export interface Selection {
  specId: string;
  endpointKey: string;
}

let pending: Selection | null = null;
const listeners = new Set<(s: Selection) => void>();

/** Ask the mode to show an endpoint. The mode may not be mounted yet, so the
 *  request is held until someone takes it. */
export function requestSelection(selection: Selection): void {
  pending = selection;
  listeners.forEach((cb) => cb(selection));
}

export function takeSelection(): Selection | null {
  const s = pending;
  pending = null;
  return s;
}

export function onSelection(cb: (s: Selection) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
