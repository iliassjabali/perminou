// Perminou — prototype sample data
//
// This is hardcoded, static data for the throwaway Expo prototype (see
// apps/mobile/README.md). It is NOT how the real mobile app will get its
// questions — the real app fetches the question bank live from the backend
// via `rpc-react` (see the `perminou-mobile-ui` skill / ADR 0003, 0007).
//
// Media (images/audio) is served directly by NARSA's public bucket, no auth
// required, so we can point straight at it.

export type SampleAnswer = {
  id: string;
  label: string;
};

export type SampleQuestion = {
  id: number;
  category: string;
  imageUrl: string | null;
  soundUrl: string | null;
  answers: SampleAnswer[];
  /**
   * DEMO placeholders only. The real correct answers come from the scraper
   * (Plan 5) once it extracts them from NARSA's answer key — these values
   * exist purely so this prototype screen has something to reveal on
   * "Valider".
   */
  correctAnswerIds: string[];
};

const BASE = 'https://perminou.narsa.gov.ma/media/uploads/questions';

export const SAMPLES: SampleQuestion[] = [
  {
    id: 46,
    category: 'B',
    imageUrl: `${BASE}/images/fr/046.png`,
    soundUrl: null,
    answers: [
      { id: '2338', label: '1' },
      { id: '2339', label: '2' },
    ],
    correctAnswerIds: ['2338'],
  },
  {
    id: 565,
    category: 'B',
    imageUrl: `${BASE}/images/fr/565.png`,
    soundUrl: `${BASE}/son/fr/565.mp3`,
    answers: [
      { id: '933', label: '1' },
      { id: '934', label: '2' },
      { id: '935', label: '3' },
      { id: '936', label: '4' },
    ],
    correctAnswerIds: ['933', '935'],
  },
  {
    id: 800,
    category: 'B',
    imageUrl: null,
    soundUrl: `${BASE}/son/fr/800.mp3`,
    answers: [
      { id: 'x1', label: '1' },
      { id: 'x2', label: '2' },
      { id: 'x3', label: '3' },
    ],
    correctAnswerIds: ['x2'],
  },
];
