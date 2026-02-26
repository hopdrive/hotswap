import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface ScreenshotProps {
  src: string;
  alt?: string;
  caption?: string;
}

export default function Screenshot({ src, alt, caption }: ScreenshotProps) {
  return (
    <Paper variant="outlined" sx={{ my: 3, overflow: 'hidden', borderRadius: 2 }}>
      <Box
        component="img"
        src={src}
        alt={alt ?? ''}
        sx={{ width: '100%', display: 'block' }}
      />
      {caption && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 2, py: 1 }}
        >
          {caption}
        </Typography>
      )}
    </Paper>
  );
}
