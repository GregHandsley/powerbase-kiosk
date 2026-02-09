/**
 * Utility functions for checking booking permissions
 */

import type { ActiveInstance } from '../types/snapshot';
import type { OrgRole } from '../types/auth';
import { isCoachRole } from '../types/auth';

/**
 * Check if a user can edit a booking
 *
 * Rules:
 * - Admins can edit any booking
 * - Coach-like roles (S&C Coach, Fitness Coach, etc.) can only edit their own bookings (created_by matches user id)
 * - Locked bookings can only be edited by admins
 *
 * @param booking - The booking to check
 * @param userId - Current user's ID
 * @param role - Current user's role
 * @returns true if user can edit the booking
 */
export function canEditBooking(
  booking: ActiveInstance | null,
  userId: string | null,
  role: OrgRole | null
): boolean {
  if (!booking || !userId || !role) return false;

  // Admins can edit any booking
  if (role === 'admin') return true;

  // Locked bookings can only be edited by admins
  if (booking.isLocked) return false;

  // Coach-like roles can only edit their own bookings
  if (isCoachRole(role)) {
    return booking.createdBy === userId;
  }

  return false;
}

/**
 * Check if a user can move/drag a booking (for live view)
 *
 * Rules:
 * - Only admins can move bookings
 *
 * @param role - Current user's role
 * @returns true if user can move bookings
 */
export function canMoveBooking(role: OrgRole | null): boolean {
  return role === 'admin';
}
