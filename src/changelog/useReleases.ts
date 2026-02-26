import { useMemo, useState, useEffect } from 'react';
import type { CompiledRelease } from '../core/types';

/**
 * Returns compiled releases sorted newest-first.
 * Prefers the explicit `releases` prop; falls back to virtual module data.
 */
export default function useReleases(explicitReleases?: CompiledRelease[]): CompiledRelease[] {
  const [virtualReleases, setVirtualReleases] = useState<CompiledRelease[]>([]);

  useEffect(() => {
    if (explicitReleases) return;
    import('virtual:hotswap-releases')
      .then((mod: { releases: CompiledRelease[] }) => setVirtualReleases(mod.releases))
      .catch(() => {
        // Virtual module not available — no Vite MDX plugin
      });
  }, [explicitReleases]);

  return useMemo(() => {
    const data = explicitReleases ?? virtualReleases;
    return [...data].sort((a, b) => {
      const va = a.frontmatter.version.split('.').map(Number);
      const vb = b.frontmatter.version.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((vb[i] ?? 0) !== (va[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0);
      }
      return 0;
    });
  }, [explicitReleases, virtualReleases]);
}
