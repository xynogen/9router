"use client";

import { useEffect, useState } from "react";

// Module-level so every card on a page shares one download.
let cached = null;
let pending = null;

function load() {
  pending ??= fetch("/api/models/benchmarks")
    .then((response) => (response.ok ? response.json() : { models: [] }))
    .then((data) => {
      cached = data.models || [];
      return cached;
    })
    .catch(() => cached || [])
    .finally(() => { pending = null; });
  return pending;
}

export function useModelBenchmarks() {
  const [models, setModels] = useState(cached || []);

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    load().then((list) => { if (!cancelled) setModels(list); });
    return () => { cancelled = true; };
  }, []);

  return models;
}
