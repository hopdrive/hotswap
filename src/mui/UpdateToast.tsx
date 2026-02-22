// ── Update toast ─────────────────────────────────────────────────────
// Fixed-position notification at bottom-right with idle-aware countdown.

import Paper from '@mui/material/Paper';
import Fade from '@mui/material/Fade';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CloseIcon from '@mui/icons-material/Close';
import CountdownButton from './CountdownButton';
import type { ToastPhase } from '../react/useUpdateToastState';
import type { Impact, VersionJson } from '../core/types';

export interface UpdateToastProps {
  phase: ToastPhase;
  secondsRemaining: number;
  remoteVersion: VersionJson;
  countdownFrom: number;
  onReloadNow: () => void;
  onPostpone: () => void;
  onDismiss: () => void;
  onViewChangelog?: () => void;
}

function headlineForImpact(impact: Impact, version: string): string {
  if (impact === 'major') return `Update recommended (v${version})`;
  if (impact === 'critical') return `Critical update (v${version})`;
  return `Update available (v${version})`;
}

function bodyForImpact(impact: Impact, summary: string): string {
  if (summary) return summary;
  switch (impact) {
    case 'major':
      return 'A new version is available with important changes.';
    case 'critical':
      return 'Please reload to continue with the latest update.';
    default:
      return 'Bug fixes and improvements are ready.';
  }
}

export default function UpdateToast({
  phase,
  secondsRemaining,
  remoteVersion,
  countdownFrom,
  onReloadNow,
  onPostpone,
  onDismiss,
  onViewChangelog,
}: UpdateToastProps) {
  const open = phase === 'toast_visible' || phase === 'countdown';
  const showCountdown = phase === 'countdown';

  const { impact, version, notes } = remoteVersion;
  const headline = headlineForImpact(impact, version);
  const body = bodyForImpact(impact, notes.summary);

  return (
    <Fade in={open} unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: (theme) => theme.spacing(3),
          right: (theme) => theme.spacing(3),
          width: 360,
          maxWidth: (theme) => `calc(100vw - ${theme.spacing(6)})`,
          borderRadius: 1.5,
          overflow: 'hidden',
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SystemUpdateAltIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              {headline}
            </Typography>
            <IconButton size="small" onClick={onDismiss} aria-label="Dismiss">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Body */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {body}
            {onViewChangelog && (
              <>
                {' '}
                <Link
                  component="button"
                  variant="body2"
                  onClick={onViewChangelog}
                >
                  See what&apos;s new
                </Link>
              </>
            )}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={onPostpone}
              sx={{ flex: 1 }}
            >
              Postpone
            </Button>
            {showCountdown ? (
              <CountdownButton
                seconds={secondsRemaining}
                totalSeconds={countdownFrom}
                onClick={onReloadNow}
              />
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={onReloadNow}
                sx={{ flex: 1 }}
              >
                Reload now
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Fade>
  );
}
