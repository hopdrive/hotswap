// ── Countdown button ────────────────────────────────────────────────
// A contained button with a left-to-right progress fill overlay.
// The fill sweeps across the button as seconds tick down.
// Clicking fires the action immediately.

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

export interface CountdownButtonProps {
  /** Seconds remaining. */
  seconds: number;
  /** Total seconds the countdown started from. */
  totalSeconds: number;
  /** Fires immediately on click. */
  onClick: () => void;
}

export default function CountdownButton({
  seconds,
  totalSeconds,
  onClick,
}: CountdownButtonProps) {
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  return (
    <Button
      variant="contained"
      size="small"
      onClick={onClick}
      disableElevation
      sx={{
        position: 'relative',
        overflow: 'hidden',
        textTransform: 'none',
        fontWeight: 700,
        px: 3,
      }}
    >
      {/* Progress fill overlay (left → right) */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress}%`,
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          transition: 'width 1s linear',
        }}
      />
      {/* Label */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        Reloading in {seconds}s
      </Box>
    </Button>
  );
}
