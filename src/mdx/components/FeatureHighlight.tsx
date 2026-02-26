import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export interface FeatureHighlightProps {
  title: string;
  children: React.ReactNode;
}

export default function FeatureHighlight({ title, children }: FeatureHighlightProps) {
  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      <AutoAwesomeIcon sx={{ color: 'primary.main', mt: 0.25 }} />
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          {children}
        </Typography>
      </Box>
    </Box>
  );
}
