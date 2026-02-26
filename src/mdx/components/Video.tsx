import Box from '@mui/material/Box';

export interface VideoProps {
  src: string;
  poster?: string;
}

export default function Video({ src, poster }: VideoProps) {
  return (
    <Box sx={{ my: 3, borderRadius: 2, overflow: 'hidden' }}>
      <Box
        component="video"
        controls
        preload="metadata"
        poster={poster}
        sx={{ width: '100%', display: 'block' }}
      >
        <source src={src} />
      </Box>
    </Box>
  );
}
