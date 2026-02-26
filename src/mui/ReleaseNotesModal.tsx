// ── ReleaseNotesModal ────────────────────────────────────────────────
// Announcement-style dialog for structured release notes.
// Consumes VersionNotes from version.json with optional hero image,
// structured feature rows, and dual-CTA footer.

import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
    <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
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
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.5, color: 'text.secondary' }}>
        <FeatureIcon name={feature.icon} />
      </Box>
      <Box>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {feature.heading}
        </Typography>
        <Typography variant="body2" color="text.secondary">
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
        <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
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
}

export default function ReleaseNotesModal({
  open,
  notes,
  version,
  impact,
  onClose,
}: ReleaseNotesModalProps) {
  const heroImage = notes.media?.find((m) => m.type === 'image');
  const hasFeatures = notes.features && notes.features.length > 0;
  const hasBullets = notes.bullets.length > 0;
  const hasFooter = notes.learnMoreUrl || notes.ctaUrl;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
        },
      }}
    >
      {/* Zone 1: Hero image */}
      {heroImage && <HeroImage media={heroImage} />}

      {/* Zone 2: Heading */}
      <Box sx={{ px: 3, pt: heroImage ? 0 : 3, pb: 1 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 1 }}
        >
          {overlineForImpact(impact)} &mdash; v{version}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {notes.title}
        </Typography>
      </Box>

      {/* Zone 3: Feature rows or bullet fallback */}
      <Box sx={{ px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              py: 1.5,
            }}
          >
            {notes.learnMoreUrl ? (
              <Button
                variant="text"
                size="small"
                endIcon={<OpenInNewIcon />}
                href={notes.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn More
              </Button>
            ) : (
              <Box />
            )}
            {notes.ctaUrl && (
              <Button
                variant="contained"
                size="small"
                endIcon={<OpenInNewIcon />}
                href={notes.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {notes.ctaLabel ?? 'Get Started'}
              </Button>
            )}
          </Box>
        </>
      )}
    </Dialog>
  );
}
