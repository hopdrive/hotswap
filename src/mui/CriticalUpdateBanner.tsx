// ── Critical update banner ───────────────────────────────────────────
// Persistent MUI Alert for critical-impact updates. Cannot be dismissed.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import type { VersionJson } from '../core/types';

export interface CriticalUpdateBannerProps {
  remoteVersion: VersionJson;
  onReload: () => void;
  /** Seconds remaining in idle countdown. */
  secondsRemaining?: number;
  /** Whether to show the countdown in the reload button. */
  showCountdown?: boolean;
}

export default function CriticalUpdateBanner({
  remoteVersion,
  onReload,
  secondsRemaining,
  showCountdown = false,
}: CriticalUpdateBannerProps) {
  const reloadLabel =
    showCountdown && secondsRemaining != null
      ? `Reload to continue (${secondsRemaining}s)`
      : 'Reload to continue';

  return (
    <Alert
      severity="error"
      variant="filled"
      sx={{
        borderRadius: 0,
        '& .MuiAlert-message': { flex: 1 },
      }}
      action={
        <Button color="inherit" size="small" variant="outlined" onClick={onReload}>
          {reloadLabel}
        </Button>
      }
    >
      Security update available (v{remoteVersion.version})
    </Alert>
  );
}
