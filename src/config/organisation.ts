// src/config/organisation.ts

import { ORG_OVERRIDE } from './env';

export type Organisation = 'facilityos' | 'loughboroughsport';

const HOSTNAME_MAP: Record<string, Organisation> = {
  'facilityos.co.uk': 'facilityos',
  'www.facilityos.co.uk': 'facilityos',
  'loughboroughsport.facilityos.co.uk': 'loughboroughsport',
};

function isOrganisation(value: unknown): value is Organisation {
  return value === 'facilityos' || value === 'loughboroughsport';
}

export function getOrganisation(): Organisation {
  // 1️⃣ Explicit override (dev / preview / CI)
  if (isOrganisation(ORG_OVERRIDE)) {
    return ORG_OVERRIDE;
  }

  // 2️⃣ Non-browser safety
  if (typeof window === 'undefined') {
    return 'facilityos';
  }

  const hostname = window.location.hostname.toLowerCase();

  // 3️⃣ Local dev defaults
  if (
    hostname === 'localhost' ||
    hostname.startsWith('localhost:') ||
    hostname.startsWith('127.0.0.1')
  ) {
    return 'facilityos';
  }

  // 4️⃣ Production mapping
  return HOSTNAME_MAP[hostname] ?? 'facilityos';
}
