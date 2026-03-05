import type { OrgRole } from '../../../types/auth';

export type BookingFamily = {
  id: number;
  organization_id: number;
  name: string;
  active: boolean;
  sort_order: number;
};

export type BookingSquad = {
  id: number;
  family_id: number;
  organization_id: number;
  name: string;
  logo_url: string | null;
  active: boolean;
  sort_order: number;
};

export type CreateBookingFlowProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  role: OrgRole;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSide?: 'Power' | 'Base';
  initialRacks?: number[];
};
