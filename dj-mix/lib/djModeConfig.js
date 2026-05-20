/**
 * djModeConfig.js - DJ Mode button configuration
 */

export const DJ_MODES = {
  dance: {
    id: 'dance',
    label: 'Dance',
    emoji: '🕺',
    title: 'Priorise les chansons dansables avec BPM élevé',
    ariaLabel: 'Mode Dance',
    ariaPressed: false,
  },
  music: {
    id: 'music',
    label: 'Musique',
    emoji: '🎵',
    title: 'Priorise les chansons du même genre ou artiste',
    ariaLabel: 'Mode Musique',
    ariaPressed: true,
  },
};

export const DJ_MODE_LIST = [DJ_MODES.dance, DJ_MODES.music];
