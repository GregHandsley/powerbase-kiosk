import { useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { formatDateBritish, formatDateBritishShort } from "../shared/dateUtils";
import type { BookingForTeam, ProcessedSnapshot } from "../../hooks/useBookingsTeam";

type Change = {
  type: "capacity" | "time" | "racks" | "extended" | "sessions_removed";
  message: string;
  oldValue?: string | number;
  newValue?: string | number;
};

type Props = {
  booking: BookingForTeam;
  acknowledgedChanges?: Set<number>; // Index of acknowledged changes
  onAcknowledgeChange?: (changeIndex: number, acknowledged: boolean) => void;
  onChangesCountChange?: (count: number) => void; // Callback to notify parent of change count
};

export function BookingChanges({ booking, acknowledgedChanges = new Set(), onAcknowledgeChange, onChangesCountChange }: Props) {
  const changes = useMemo(() => {
    if (!booking.processed_snapshot || !booking.processed_at) return [];

    const snapshot = booking.processed_snapshot;
    const current = booking.instances;
    const firstCurrent = current[0];
    const lastCurrent = current[current.length - 1];

    const detectedChanges: Change[] = [];

    // Check if booking was extended (more instances)
    if (current.length > snapshot.instanceCount) {
      const newSessions = current.slice(snapshot.instanceCount);
      const newDates = newSessions.map(inst => formatDateBritish(inst.start));
      detectedChanges.push({
        type: "extended",
        message: `Booking extended: ${snapshot.instanceCount} → ${current.length} sessions. New sessions: ${newDates.slice(0, 3).join(", ")}${newDates.length > 3 ? ` +${newDates.length - 3} more` : ""}`,
        oldValue: snapshot.instanceCount,
        newValue: current.length,
      });
    }

    // Check if sessions were removed
    if (current.length < snapshot.instanceCount) {
      const removedCount = snapshot.instanceCount - current.length;
      
      // If we have stored instance dates in snapshot, we can identify which specific sessions were deleted
      if (snapshot.allInstanceStarts && snapshot.allInstanceStarts.length > 0) {
        const currentStartDates = new Set(current.map(inst => inst.start));
        const removedStartDates = snapshot.allInstanceStarts.filter(
          startDate => !currentStartDates.has(startDate)
        );
        
        if (removedStartDates.length > 0) {
          const removedDates = removedStartDates.map(date => formatDateBritish(date));
          
          if (removedDates.length === 1) {
            detectedChanges.push({
              type: "sessions_removed",
              message: `Session removed:\n• ${removedDates[0]}`,
              oldValue: snapshot.instanceCount,
              newValue: current.length,
            });
          } else {
            const sessionDetails = removedDates.map(date => `• ${date}`).join("\n");
            detectedChanges.push({
              type: "sessions_removed",
              message: `${removedCount} sessions removed:\n${sessionDetails}`,
              oldValue: snapshot.instanceCount,
              newValue: current.length,
            });
          }
        } else {
          // Fallback if we can't identify specific dates
          detectedChanges.push({
            type: "sessions_removed",
            message: `${removedCount} session${removedCount !== 1 ? "s" : ""} removed: ${snapshot.instanceCount} → ${current.length} sessions`,
            oldValue: snapshot.instanceCount,
            newValue: current.length,
          });
        }
      } else {
        // Fallback for old snapshots that don't have allInstanceStarts
        // Try to infer which sessions were removed by looking at date gaps
        // This works for weekly bookings where we can detect missing weeks
        if (current.length > 0 && snapshot.firstInstanceStart) {
          const firstSnapshotDate = parseISO(snapshot.firstInstanceStart);
          const currentDates = current.map(inst => parseISO(inst.start)).sort((a, b) => a.getTime() - b.getTime());
          
          // Calculate the expected interval (assume weekly pattern)
          let intervalDays = 7; // Default to weekly
          if (currentDates.length > 1) {
            const firstCurrent = currentDates[0];
            const secondCurrent = currentDates[1];
            const diffMs = secondCurrent.getTime() - firstCurrent.getTime();
            intervalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          }
          
          // Generate expected dates based on first snapshot date and interval
          const expectedDates: Date[] = [];
          for (let i = 0; i < snapshot.instanceCount; i++) {
            const expectedDate = new Date(firstSnapshotDate);
            expectedDate.setDate(expectedDate.getDate() + (i * intervalDays));
            expectedDates.push(expectedDate);
          }
          
          // Find which expected dates are not in current dates (within a day tolerance)
          const currentDateStrings = new Set(currentDates.map(d => format(d, "yyyy-MM-dd")));
          const removedDates: string[] = [];
          
          expectedDates.forEach(expectedDate => {
            const expectedDateStr = format(expectedDate, "yyyy-MM-dd");
            if (!currentDateStrings.has(expectedDateStr)) {
              // Check if there's a close match (within 1 day) to account for timezone issues
              const hasCloseMatch = currentDates.some(currentDate => {
                const diffDays = Math.abs(
                  (currentDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                return diffDays < 1;
              });
              
              if (!hasCloseMatch) {
                removedDates.push(formatDateBritish(expectedDate));
              }
            }
          });
          
          if (removedDates.length > 0) {
            if (removedDates.length === 1) {
              detectedChanges.push({
                type: "sessions_removed",
                message: `Session removed:\n• ${removedDates[0]}`,
                oldValue: snapshot.instanceCount,
                newValue: current.length,
              });
            } else {
              const sessionDetails = removedDates.map(date => `• ${date}`).join("\n");
              detectedChanges.push({
                type: "sessions_removed",
                message: `${removedCount} sessions removed:\n${sessionDetails}`,
                oldValue: snapshot.instanceCount,
                newValue: current.length,
              });
            }
          } else {
            // Couldn't infer specific dates, show generic message
            detectedChanges.push({
              type: "sessions_removed",
              message: `${removedCount} session${removedCount !== 1 ? "s" : ""} removed: ${snapshot.instanceCount} → ${current.length} sessions`,
              oldValue: snapshot.instanceCount,
              newValue: current.length,
            });
          }
        } else {
          // No current instances or snapshot data, show generic message
          detectedChanges.push({
            type: "sessions_removed",
            message: `${removedCount} session${removedCount !== 1 ? "s" : ""} removed: ${snapshot.instanceCount} → ${current.length} sessions`,
            oldValue: snapshot.instanceCount,
            newValue: current.length,
          });
        }
      }
    }

    // Check capacity changes (compare all instances - assume all had same capacity when processed)
    if (snapshot.firstInstanceCapacity !== undefined) {
      const changedSessions: Array<{ date: string; newCapacity: number }> = [];
      
      // Check each current instance - if capacity differs from snapshot, it changed
      current.forEach((inst) => {
        const currentCapacity = inst.capacity ?? 1;
        if (currentCapacity !== snapshot.firstInstanceCapacity) {
          changedSessions.push({
            date: formatDateBritish(inst.start),
            newCapacity: currentCapacity,
          });
        }
      });

      if (changedSessions.length > 0) {
        // Show each session clearly with its specific change
        if (changedSessions.length === current.length && changedSessions.every(s => s.newCapacity === changedSessions[0].newCapacity)) {
          // All sessions changed to the same capacity
          if (current.length === 1) {
            // Single session booking
            detectedChanges.push({
              type: "capacity",
              message: `Athletes changed from ${snapshot.firstInstanceCapacity} to ${changedSessions[0].newCapacity} athletes`,
              oldValue: snapshot.firstInstanceCapacity,
              newValue: changedSessions[0].newCapacity,
            });
          } else {
            // Multiple sessions
            detectedChanges.push({
              type: "capacity",
              message: `Athletes changed: All ${current.length} sessions changed from ${snapshot.firstInstanceCapacity} to ${changedSessions[0].newCapacity} athletes`,
              oldValue: snapshot.firstInstanceCapacity,
              newValue: changedSessions[0].newCapacity,
            });
          }
        } else {
          // Build a clear list of each session's change
          const sessionDetails = changedSessions.map(({ date, newCapacity }) => 
            `• ${date}: ${snapshot.firstInstanceCapacity} → ${newCapacity} athletes`
          ).join("\n");
          
          detectedChanges.push({
            type: "capacity",
            message: `Athletes changed on ${changedSessions.length} session${changedSessions.length !== 1 ? "s" : ""}:\n${sessionDetails}`,
            oldValue: snapshot.firstInstanceCapacity,
            newValue: changedSessions.map(s => s.newCapacity).join(", "),
          });
        }
      }
    }

    // Check time changes (compare instances)
    const timeChangedSessions: Array<{ date: string; oldTime: string; newTime: string }> = [];
    
    const formatTime = (iso: string) => {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };
    
    if (snapshot.allInstanceTimes && snapshot.allInstanceTimes.length > 0) {
      // We have stored instance times, match current instances by date and compare times
      current.forEach((inst) => {
        const instDateStr = format(parseISO(inst.start), "yyyy-MM-dd");
        
        // Find the corresponding snapshot instance by matching date (within 1 day tolerance)
        const matchingSnapshotInstance = snapshot.allInstanceTimes.find((snapInst) => {
          const snapDateStr = format(parseISO(snapInst.start), "yyyy-MM-dd");
          return snapDateStr === instDateStr;
        });
        
        if (matchingSnapshotInstance) {
          // Found a matching snapshot instance by date, check if time changed
          const oldStartTime = formatTime(matchingSnapshotInstance.start);
          const oldEndTime = formatTime(matchingSnapshotInstance.end);
          const newStartTime = formatTime(inst.start);
          const newEndTime = formatTime(inst.end);
          
          if (oldStartTime !== newStartTime || oldEndTime !== newEndTime) {
            timeChangedSessions.push({
              date: formatDateBritish(inst.start),
              oldTime: `${oldStartTime}-${oldEndTime}`,
              newTime: `${newStartTime}-${newEndTime}`,
            });
          }
        }
      });
    } else {
      // Fallback for old snapshots - reconstruct expected times based on pattern
      // For old snapshots, we can only reliably detect time changes on the first instance
      // But we'll check all instances that match the first instance's date pattern
      if (snapshot.firstInstanceStart && current.length > 0) {
        const firstSnapshotDate = parseISO(snapshot.firstInstanceStart);
        const firstSnapshotTime = formatTime(snapshot.firstInstanceStart);
        const firstSnapshotEndTime = formatTime(snapshot.firstInstanceEnd);
        
        // Check all current instances - if any match the first snapshot date or are close to it,
        // and have different times, we detected a change
        current.forEach((inst) => {
          const instDate = parseISO(inst.start);
          const instDateStr = format(instDate, "yyyy-MM-dd");
          const snapshotDateStr = format(firstSnapshotDate, "yyyy-MM-dd");
          
          // For old snapshots, we assume all instances had the same time as the first instance
          // So if any instance has a different time, it changed
          const instStartTime = formatTime(inst.start);
          const instEndTime = formatTime(inst.end);
          
          // Check if times differ from snapshot times
          // For old snapshots, we assume all instances had the same time as the first instance
          if (instStartTime !== firstSnapshotTime || instEndTime !== firstSnapshotEndTime) {
            // Only add if we haven't already added this date (to avoid duplicates)
            const instDateStrForCompare = formatDateBritish(instDate);
            const alreadyAdded = timeChangedSessions.some(
              s => s.date === instDateStrForCompare
            );
            
            if (!alreadyAdded) {
              timeChangedSessions.push({
                date: instDateStrForCompare,
                oldTime: `${firstSnapshotTime}-${firstSnapshotEndTime}`,
                newTime: `${instStartTime}-${instEndTime}`,
              });
            }
          }
        });
      }
    }

    if (timeChangedSessions.length > 0) {
      if (timeChangedSessions.length === 1 && current.length === 1) {
        // Single session booking
        const change = timeChangedSessions[0];
        detectedChanges.push({
          type: "time",
          message: `Time changed from ${change.oldTime} to ${change.newTime}`,
          oldValue: change.oldTime,
          newValue: change.newTime,
        });
      } else if (timeChangedSessions.length === 1) {
        // One session in a multi-session booking
        const change = timeChangedSessions[0];
        detectedChanges.push({
          type: "time",
          message: `Time changed: ${change.date} - ${change.oldTime} → ${change.newTime}`,
          oldValue: change.oldTime,
          newValue: change.newTime,
        });
      } else {
        // Show each session's time change clearly
        const sessionDetails = timeChangedSessions.map(({ date, oldTime, newTime }) =>
          `• ${date}: ${oldTime} → ${newTime}`
        ).join("\n");
        
        detectedChanges.push({
          type: "time",
          message: `Time changed on ${timeChangedSessions.length} sessions:\n${sessionDetails}`,
          oldValue: timeChangedSessions[0].oldTime,
          newValue: timeChangedSessions[0].newTime,
        });
      }
    }

    // Check rack changes (compare each instance individually)
    const formatRacks = (racks: number[]) => {
      return Array.from(racks).sort((a, b) => a - b).join(", ");
    };
    
    // Use firstInstanceRacks as baseline (assume all instances had same racks when processed)
    // For future snapshots, we could store individual instance racks
    const baselineRacks = snapshot.firstInstanceRacks || [];
    const baselineRacksSet = new Set(baselineRacks);
    
    // Find which sessions have different racks
    const rackChangedSessions: Array<{ date: string; oldRacks: string; newRacks: string }> = [];
    
    current.forEach((inst) => {
      const instRacks = inst.racks || [];
      const instRacksSet = new Set(instRacks);
      
      // Check if racks changed by comparing sets
      const racksMatch = 
        instRacksSet.size === baselineRacksSet.size &&
        Array.from(instRacksSet).every((rack) => baselineRacksSet.has(rack));
      
      if (!racksMatch) {
        rackChangedSessions.push({
          date: formatDateBritish(inst.start),
          oldRacks: formatRacks(baselineRacks),
          newRacks: formatRacks(instRacks),
        });
      }
    });

    if (rackChangedSessions.length > 0) {
      if (rackChangedSessions.length === 1 && current.length === 1) {
        // Single session booking
        const change = rackChangedSessions[0];
        detectedChanges.push({
          type: "racks",
          message: `Racks changed from ${change.oldRacks} to ${change.newRacks}`,
          oldValue: change.oldRacks,
          newValue: change.newRacks,
        });
      } else if (rackChangedSessions.length === 1) {
        // One session in a multi-session booking
        const change = rackChangedSessions[0];
        detectedChanges.push({
          type: "racks",
          message: `Racks changed: ${change.date} - ${change.oldRacks} → ${change.newRacks}`,
          oldValue: change.oldRacks,
          newValue: change.newRacks,
        });
      } else {
        // Multiple sessions changed
        const sessionDetails = rackChangedSessions.map(({ date, oldRacks, newRacks }) =>
          `• ${date}: ${oldRacks} → ${newRacks}`
        ).join("\n");
        
        detectedChanges.push({
          type: "racks",
          message: `Racks changed on ${rackChangedSessions.length} session${rackChangedSessions.length !== 1 ? "s" : ""}:\n${sessionDetails}`,
          oldValue: rackChangedSessions[0].oldRacks,
          newValue: rackChangedSessions.map(s => s.newRacks).join(", "),
        });
      }
    }

    return detectedChanges;
  }, [booking]);

  // Notify parent of change count
  useEffect(() => {
    if (onChangesCountChange) {
      onChangesCountChange(changes.length);
    }
  }, [changes.length, onChangesCountChange]);

  if (changes.length === 0) return null;

  const changeDate = booking.last_edited_at
    ? `${formatDateBritishShort(booking.last_edited_at)} at ${format(parseISO(booking.last_edited_at), "HH:mm")}`
    : null;

  return (
    <div className="mt-3 p-3 bg-amber-900/20 border border-amber-700/50 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-amber-400">
          Changes Detected
        </div>
        {changeDate && (
          <div className="text-xs text-amber-400/70">
            {changeDate}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {changes.map((change, idx) => {
          const lines = change.message.split("\n");
          const title = lines[0];
          const details = lines.slice(1);
          const isAcknowledged = acknowledgedChanges.has(idx);
          const showCheckbox = changes.length > 1 && onAcknowledgeChange; // Only show checkbox if multiple changes
          
          return (
            <div key={idx} className={`text-sm ${isAcknowledged ? "opacity-60" : ""}`}>
              <div className="flex gap-2">
                {showCheckbox && (
                  <input
                    type="checkbox"
                    checked={isAcknowledged}
                    onChange={(e) => onAcknowledgeChange(idx, e.target.checked)}
                    className="h-4 w-4 rounded border-amber-600 bg-slate-950 text-amber-600 focus:ring-amber-500 flex-shrink-0 mt-0.5"
                  />
                )}
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1.5 leading-tight">{title}</div>
                  {details.length > 0 && (
                    <div className="text-amber-200/90 ml-3 space-y-0.5 font-mono text-xs">
                      {details.map((detail, detailIdx) => (
                        <div key={detailIdx}>{detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

