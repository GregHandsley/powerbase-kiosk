// Organization-level role definitions (2.3.1)
// Roles are assigned per organization membership, not per user profile
// Super admin is handled separately via profiles.is_super_admin (global, not per-org)
export type OrgRole =
  | 'admin'
  | 'bookings_team'
  | 'coach' // Legacy role (temporary, for backwards compatibility)
  | 'snc_coach' // S&C Coach (formerly 'coach')
  | 'fitness_coach'
  | 'customer_service_assistant'
  | 'duty_manager'
  | 'facility_manager';

// Helper function to get display name for roles
export function getRoleDisplayName(role: OrgRole): string {
  const displayNames: Record<OrgRole, string> = {
    admin: 'Admin',
    bookings_team: 'Bookings Team',
    coach: 'Coach', // Legacy - map to S&C Coach in UI
    snc_coach: 'S&C Coach',
    fitness_coach: 'Fitness Coach',
    customer_service_assistant: 'Customer Service Assistant',
    duty_manager: 'Duty Manager',
    facility_manager: 'Facility Manager',
  };
  return displayNames[role] || role;
}

// Helper to check if a role is a "coach-like" role (for permission checks)
export function isCoachRole(role: OrgRole | null): boolean {
  if (!role) return false;
  return (
    role === 'coach' || // Legacy role
    role === 'snc_coach' ||
    role === 'fitness_coach' ||
    role === 'customer_service_assistant' ||
    role === 'duty_manager'
  );
}

// Helper to check if a role is admin (for permission checks)
export function isAdminRole(role: OrgRole | null): boolean {
  return role === 'admin';
}

// Helper to determine permission level: 'admin' or 'coach' (for backward compatibility)
// Used by components that need to check admin vs non-admin permissions
export function getPermissionLevel(
  role: OrgRole | null
): 'admin' | 'coach' | null {
  if (!role) return null;
  if (role === 'admin') return 'admin';
  if (isCoachRole(role)) return 'coach';
  // For other roles (bookings_team, facility_manager), treat as 'coach' for now
  // This can be refined later with proper permission system
  return 'coach';
}

// Legacy: ProfileRole kept for backward compatibility during migration
// TODO: Remove once all code uses OrgRole from organization_memberships
export type ProfileRole = 'admin' | 'coach'; // Legacy - 'coach' maps to 'snc_coach' in new system

// Legacy: UserRole kept for backward compatibility
// TODO: Replace with OrgRole throughout codebase
export type UserRole = OrgRole | 'super_admin';

export interface Profile {
  id: string;
  full_name: string | null;
  role: ProfileRole; // Legacy field - roles now come from organization_memberships
  is_super_admin: boolean; // Global super admin flag (not per-org)
  created_at: string;
}

// Organization membership with role
export interface OrganizationMembership {
  id: number;
  organization_id: number;
  user_id: string;
  role: OrgRole; // Organization-level role (no super_admin here)
  created_at: string;
}
