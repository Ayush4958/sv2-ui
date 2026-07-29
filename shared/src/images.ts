import type { SetupData } from './types.js';

export const SV2_APP_IMAGES = {
  // Development branches track sv2-apps `main`. The matching release/vX
  // branch replaces all of these with its approved sv2-apps `vX` release
  // tags before sv2-ui is published.
  translatorNoJd: 'stratumv2/translator_sv2:main',
  jd: {
    jdc: 'stratumv2/jd_client_sv2:main',
    translator: 'stratumv2/translator_sv2:main',
  },
} as const satisfies {
  translatorNoJd: string;
  jd: { jdc: string; translator: string };
};

export type SetupImageSelection =
  | {
      mode: 'no-jd';
      translator: string;
    }
  | {
      mode: 'jd';
      jdc: string;
      translator: string;
    };

export function getImageSelectionForSetup(data: SetupData): SetupImageSelection {
  if (data.mode === 'no-jd') {
    return {
      mode: 'no-jd',
      translator: SV2_APP_IMAGES.translatorNoJd,
    };
  }

  if (data.mode === 'jd') {
    return {
      mode: 'jd',
      jdc: SV2_APP_IMAGES.jd.jdc,
      translator: SV2_APP_IMAGES.jd.translator,
    };
  }

  throw new Error('Setup mode is required before selecting sv2-apps images.');
}
