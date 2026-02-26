import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

export interface CalloutProps {
  severity?: AlertColor;
  children: React.ReactNode;
}

export default function Callout({ severity = 'info', children }: CalloutProps) {
  return (
    <Alert severity={severity} variant="outlined" sx={{ my: 3, borderRadius: 2 }}>
      {children}
    </Alert>
  );
}
