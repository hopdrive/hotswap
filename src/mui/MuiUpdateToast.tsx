// ── MuiUpdateToast ──────────────────────────────────────────────────
// Connected component that wires useUpdateToastState() to the
// UpdateToast and CriticalUpdateBanner components automatically.
// Zero props needed — just <MuiUpdateToast />.

import { useUpdateToastState } from '../react/useUpdateToastState';
import { useUpdateContext } from '../react/UpdateProvider';
import UpdateToast from './UpdateToast';
import CriticalUpdateBanner from './CriticalUpdateBanner';
import ReleaseNotesModal from './ReleaseNotesModal';

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

  const hasFeatures = (remoteVersion?.notes.features?.length ?? 0) > 0;

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

      {/* Rich modal for releases with features */}
      {remoteVersion && hasFeatures && (
        <ReleaseNotesModal
          open={phase === 'toast_visible' || phase === 'countdown'}
          notes={remoteVersion.notes}
          version={remoteVersion.version}
          impact={remoteVersion.impact}
          onClose={onDismiss}
          showCountdown={phase === 'countdown'}
          secondsRemaining={secondsRemaining}
          countdownFrom={config.countdownSeconds}
          onReloadNow={onReloadNow}
        />
      )}

      {/* Simple toast fallback for patches without features */}
      {remoteVersion && !hasFeatures && (
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
