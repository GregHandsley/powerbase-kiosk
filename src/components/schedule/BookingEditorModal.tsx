import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import type { ActiveInstance } from "../../types/snapshot";
import clsx from "clsx";

type Props = {
  booking: ActiveInstance | null;
  isOpen: boolean;
  onClose: () => void;
  onClearRacks: () => void;
  onSaveTitle?: (title: string) => Promise<void>;
};

/**
 * Simple modal for editing booking name and clearing rack selection.
 */
export function BookingEditorModal({
  booking,
  isOpen,
  onClose,
  onClearRacks,
  onSaveTitle,
}: Props) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize title when booking changes
  useEffect(() => {
    if (booking) {
      setTitle(booking.title);
    } else {
      setTitle("");
    }
    setError(null);
  }, [booking]);

  if (!isOpen || !booking) return null;

  const isLocked = booking.isLocked && role !== "admin";
  const hasTitleChanges = title !== booking.title;

  const handleSaveTitle = async () => {
    if (!hasTitleChanges) {
      onClose();
      return;
    }

    if (!title.trim()) {
      setError("Title cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (onSaveTitle) {
        await onSaveTitle(title);
      } else {
        // Fallback: update directly
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ title: title.trim() })
          .eq("id", booking.bookingId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
        await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      }

      onClose();
    } catch (err) {
      console.error("Failed to update booking title", err);
      setError(err instanceof Error ? err.message : "Failed to update booking title");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (booking) {
      setTitle(booking.title);
    }
    setError(null);
    onClose();
  };

  const handleClearRacks = () => {
    onClearRacks();
    // Don't call onClose here - let the parent handle closing the modal
    // The modal will close automatically when isSelectingRacks becomes true
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Edit Booking</h2>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(booking.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                {new Date(booking.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {isLocked && (
              <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-slate-400 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="Locked"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Locked
              </span>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Session Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLocked || saving}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter session name"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-700/50 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-700">
            <button
              type="button"
              onClick={handleClearRacks}
              disabled={isLocked || saving}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-md",
                "bg-slate-700 hover:bg-slate-600 text-slate-100",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Edit Racks
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTitle}
                disabled={saving || isLocked || !hasTitleChanges || !title.trim()}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded-md",
                  "bg-indigo-600 hover:bg-indigo-500 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

