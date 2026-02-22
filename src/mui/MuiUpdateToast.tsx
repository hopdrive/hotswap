// ── MuiUpdateToast ──────────────────────────────────────────────────
// Connected component that wires useUpdateToastState() to the
// UpdateToast and CriticalUpdateBanner components automatically.
// Zero props needed — just <MuiUpdateToast />.

import { useUpdateToastState } from '../react/useUpdateToastState';
import { useUpdateContext } from '../react/UpdateProvider';
import UpdateToast from './UpdateToast';
import CriticalUpdateBanner from './CriticalUpdateBanner';

export default function MuiUpdateToast() {
  const { config } = useUpdateContext();

  const {
    phase,
    secondsRemaining,
    remoteVersion,
    isCritical,
    onViewChangelog,
    onPostpone,
    onReloadNow,
    onDismiss,
  } = useUpdateToastState();

  return (
    <>
      {/* Critical banner sits above everything */}
      {isCritical && remoteVersion && (
        <CriticalUpdateBanner
          remoteVersion={remoteVersion}
          onReload={onReloadNow}
          secondsRemaining={secondsRemaining}
          showCountdown={phase === 'countdown'}
        />
      )}

      {/* Update toast — shown for all impact levels */}
      {remoteVersion && (
        <UpdateToast
          phase={phase}
          secondsRemaining={secondsRemaining}
          remoteVersion={remoteVersion}
          countdownFrom={config.countdownSeconds}
          onReloadNow={onReloadNow}
          onPostpone={onPostpone}
          onDismiss={onDismiss}
          onViewChangelog={config.onNavigateToChangelog ? onViewChangelog : undefined}
        />
      )}
    </>
  );
}
