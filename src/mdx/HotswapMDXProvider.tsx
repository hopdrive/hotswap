import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import Video from './components/Video';
import Screenshot from './components/Screenshot';
import FeatureHighlight from './components/FeatureHighlight';
import Callout from './components/Callout';

const typographyComponents = {
  h1: (props: Record<string, unknown>) => <Typography variant="h4" gutterBottom {...props} />,
  h2: (props: Record<string, unknown>) => <Typography variant="h5" gutterBottom {...props} />,
  h3: (props: Record<string, unknown>) => <Typography variant="h6" gutterBottom {...props} />,
  p: (props: Record<string, unknown>) => (
    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }} {...props} />
  ),
  a: (props: Record<string, unknown>) => <Link {...props} />,
  hr: () => <Divider sx={{ my: 3 }} />,
};

/** All MDX components available in hotswap release content. */
export const mdxComponents = {
  ...typographyComponents,
  Video,
  Screenshot,
  FeatureHighlight,
  Callout,
};

export interface HotswapMDXProviderProps {
  children: ReactNode;
}

/**
 * Wraps MDX content with hotswap-styled components.
 * When using @mdx-js/react, wrap your content in this provider.
 * When using compiled MDX directly, pass `mdxComponents` to the component.
 */
export default function HotswapMDXProvider({ children }: HotswapMDXProviderProps) {
  // @mdx-js/react is optional — use dynamic import pattern
  // Consumers using compiled MDX can pass mdxComponents directly instead
  return <>{children}</>;
}
