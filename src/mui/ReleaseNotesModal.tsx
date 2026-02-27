// ── ReleaseNotesModal ────────────────────────────────────────────────
// Fixed-position bottom-right panel for structured release notes.
// Replaces UpdateToast when rich feature data is available.

import Paper from '@mui/material/Paper';
import Fade from '@mui/material/Fade';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CountdownButton from './CountdownButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloudIcon from '@mui/icons-material/Cloud';
import StorageIcon from '@mui/icons-material/Storage';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupsIcon from '@mui/icons-material/Groups';
import TimelineIcon from '@mui/icons-material/Timeline';
import BoltIcon from '@mui/icons-material/Bolt';
import PaletteIcon from '@mui/icons-material/Palette';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';
import type { Impact, VersionNotes, MediaItem, Feature } from '../core/types';

// ── Icon mapping ────────────────────────────────────────────────────

const ICON_MAP: Record<string, ComponentType<SvgIconProps>> = {
  PlayArrow: PlayArrowIcon,
  AccountTree: AccountTreeIcon,
  Speed: SpeedIcon,
  Security: SecurityIcon,
  Build: BuildIcon,
  AutoAwesome: AutoAwesomeIcon,
  RocketLaunch: RocketLaunchIcon,
  BugReport: BugReportIcon,
  Cloud: CloudIcon,
  Storage: StorageIcon,
  IntegrationInstructions: IntegrationInstructionsIcon,
  Settings: SettingsIcon,
  Visibility: VisibilityIcon,
  Notifications: NotificationsIcon,
  Groups: GroupsIcon,
  Timeline: TimelineIcon,
  Bolt: BoltIcon,
  Palette: PaletteIcon,
  People: PeopleIcon,
  TrendingUp: TrendingUpIcon,
};

function FeatureIcon({ name }: { name?: string }) {
  const Icon = (name && ICON_MAP[name]) || InfoOutlinedIcon;
  return <Icon fontSize="small" />;
}

// ── Overline text ───────────────────────────────────────────────────

function overlineForImpact(impact: Impact): string {
  switch (impact) {
    case 'critical': return 'Critical Update';
    case 'major':    return 'Now Available';
    case 'minor':    return 'New Feature';
    default:         return "What's New";
  }
}

// ── Sub-components ──────────────────────────────────────────────────

function HeroImage({ media }: { media: MediaItem }) {
  return (
    <Box sx={{ position: 'relative', height: 140, overflow: 'hidden' }}>
      <Box
        component="img"
        src={media.src}
        alt={media.alt ?? ''}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60%',
          background: (theme) =>
            `linear-gradient(to bottom, transparent, ${theme.palette.background.paper})`,
        }}
      />
    </Box>
  );
}

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.25, color: 'text.secondary' }}>
        <FeatureIcon name={feature.icon} />
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {feature.heading}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {feature.description}
        </Typography>
      </Box>
    </Box>
  );
}

function BulletList({ bullets }: { bullets: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {bullets.map((bullet, i) => (
        <Typography key={i} component="li" variant="caption" color="text.secondary" sx={{ py: 0.25 }}>
          {bullet}
        </Typography>
      ))}
    </Box>
  );
}

// ── Main component ──────────────────────────────────────────────────

export interface ReleaseNotesModalProps {
  open: boolean;
  notes: VersionNotes;
  version: string;
  impact: Impact;
  onClose: () => void;
  /** When true, the CTA becomes a countdown reload button. */
  showCountdown?: boolean;
  /** Seconds remaining in the countdown. */
  secondsRemaining?: number;
  /** Total seconds the countdown started from. */
  countdownFrom?: number;
  /** Fires when user clicks reload (or countdown finishes). */
  onReloadNow?: () => void;
}

export default function ReleaseNotesModal({
  open,
  notes,
  version,
  impact,
  onClose,
  showCountdown = false,
  secondsRemaining = 0,
  countdownFrom = 30,
  onReloadNow,
}: ReleaseNotesModalProps) {
  const heroImage = notes.media?.find((m) => m.type === 'image');
  const hasFeatures = notes.features && notes.features.length > 0;
  const hasBullets = notes.bullets.length > 0;
  const hasFooter = notes.learnMoreUrl || onReloadNow;

  return (
    <Fade in={open} unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: (theme) => theme.spacing(3),
          right: (theme) => theme.spacing(3),
          width: 380,
          maxWidth: (theme) => `calc(100vw - ${theme.spacing(6)})`,
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        {/* Dismiss button */}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Dismiss"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Zone 1: Hero image */}
        {heroImage && <HeroImage media={heroImage} />}

        {/* Zone 2: Heading */}
        <Box sx={{ px: 2.5, pt: heroImage ? 0 : 2.5, pb: 0.5 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 1, fontSize: '0.65rem' }}
          >
            {overlineForImpact(impact)} &mdash; v{version}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {notes.title}
          </Typography>
        </Box>

        {/* Zone 3: Feature rows or bullet fallback */}
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {hasFeatures
            ? notes.features!.map((f, i) => <FeatureRow key={i} feature={f} />)
            : hasBullets && <BulletList bullets={notes.bullets} />
          }
        </Box>

        {/* Zone 4: Divider + Footer */}
        {hasFooter && (
          <>
            <Divider />
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 2,
                py: 1,
              }}
            >
              {notes.learnMoreUrl ? (
                <Button
                  variant="text"
                  size="small"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                  href={notes.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                >
                  Learn More
                </Button>
              ) : (
                <Box />
              )}
              {onReloadNow && (
                showCountdown ? (
                  <CountdownButton
                    seconds={secondsRemaining}
                    totalSeconds={countdownFrom}
                    onClick={onReloadNow}
                  />
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    disableElevation
                    onClick={onReloadNow}
                    sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Reload now
                  </Button>
                )
              )}
            </Box>
          </>
        )}
      </Paper>
    </Fade>
  );
}
