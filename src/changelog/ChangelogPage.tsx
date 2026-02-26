import { useEffect } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { CompiledRelease } from '../core/types';
import useReleases from './useReleases';
import ReleaseEntry from './ReleaseEntry';

export interface ChangelogPageProps {
  /** Explicit releases data. If omitted, reads from virtual:hotswap-releases. */
  releases?: CompiledRelease[];
}

export default function ChangelogPage({ releases: explicitReleases }: ChangelogPageProps) {
  const releases = useReleases(explicitReleases);

  // Scroll to hash on mount (e.g., /changelog#v1.3.0)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash) return;
    // Small delay to let content render
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
        Changelog
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Release history and what changed in each version.
      </Typography>

      {releases.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No releases found.
          </Typography>
        </Box>
      )}

      {releases.map((release) => (
        <ReleaseEntry key={release.frontmatter.version} release={release} />
      ))}
    </Container>
  );
}
