import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import type { CompiledRelease, Impact } from '../core/types';
import { mdxComponents } from '../mdx/HotswapMDXProvider';

function chipColor(impact: Impact): 'error' | 'warning' | 'info' | 'default' {
  switch (impact) {
    case 'critical': return 'error';
    case 'major': return 'warning';
    case 'minor': return 'info';
    default: return 'default';
  }
}

export interface ReleaseEntryProps {
  release: CompiledRelease;
}

export default function ReleaseEntry({ release }: ReleaseEntryProps) {
  const { frontmatter, Component } = release;

  return (
    <Box id={`v${frontmatter.version}`} sx={{ scrollMarginTop: 80 }}>
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          v{frontmatter.version}
        </Typography>
        <Chip
          label={frontmatter.impact}
          color={chipColor(frontmatter.impact)}
          size="small"
          variant="outlined"
        />
      </Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {frontmatter.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {frontmatter.summary}
      </Typography>
      <Component components={mdxComponents} />
    </Box>
  );
}
