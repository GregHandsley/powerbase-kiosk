import { useState, useEffect } from "react";
import { addDays } from "date-fns";
import { getSideIdByKeyNode, type SideKey } from "../../nodes/data/sidesNodes";
import { CapacityEditModal } from "./CapacityEditModal";
import { WeekNavigationHeader } from "./capacity/WeekNavigationHeader";
import { CapacityCalendarGrid } from "./capacity/CapacityCalendarGrid";
import { DeleteScheduleDialog } from "./capacity/DeleteScheduleDialog";
import { useCapacitySchedules } from "./capacity/useCapacitySchedules";
import { useScheduleDeletion } from "./capacity/useScheduleDeletion";
import { useScheduleSaving } from "./capacity/useScheduleSaving";
import { generateTimeSlots, getCapacityKey, type PeriodType, type RecurrenceType, type TimeSlot } from "./capacity/scheduleUtils";

export function CapacityManagement() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedSide, setSelectedSide] = useState<"Power" | "Base">("Power");
  const [sideId, setSideId] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{
    date: Date;
    time: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timeSlots = generateTimeSlots();

  // Fetch side ID
  useEffect(() => {
    getSideIdByKeyNode(selectedSide as SideKey)
      .then(setSideId)
      .catch(console.error);
  }, [selectedSide]);

  // Fetch capacity schedules
  const { capacityData, scheduleData } = useCapacitySchedules(sideId, currentWeek, refreshKey);

  // Schedule deletion hook
  const {
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    deleteMode,
    setDeleteMode,
    confirmDeleteSchedule,
  } = useScheduleDeletion(sideId);

  // Schedule saving hook
  const { saveCapacity } = useScheduleSaving(sideId);

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek((prev) => addDays(prev, direction === "next" ? 7 : -7));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  const handleCellClick = (day: Date, timeSlot: TimeSlot) => {
    const timeStr = `${String(timeSlot.hour).padStart(2, "0")}:${String(timeSlot.minute).padStart(2, "0")}`;
    setEditingCell({ date: day, time: timeStr });
  };

  const handleSaveCapacity = async (data: {
    capacity: number;
    periodType: PeriodType;
    recurrenceType: RecurrenceType;
    startTime: string;
    endTime: string;
  }) => {
    if (!editingCell) return;
    
    // Get the existing schedule IDs that we're editing
    const cellData = getCellCapacity(editingCell.date, {
      hour: parseInt(editingCell.time.split(":")[0]),
      minute: parseInt(editingCell.time.split(":")[1]),
    });
    const currentSchedule = cellData?.scheduleId ? scheduleData.get(cellData.scheduleId) : null;
    const existingScheduleIds = currentSchedule ? [currentSchedule.id] : [];
    
    await saveCapacity(data, editingCell.date, () => {
      setCurrentWeek((prev) => new Date(prev.getTime()));
      setEditingCell(null);
    }, existingScheduleIds);
  };

  const getCellCapacity = (day: Date, timeSlot: TimeSlot) => {
    const key = getCapacityKey(day, timeSlot);
    return capacityData.get(key) || null;
  };

  const handleDeleteSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setCurrentWeek((prev) => new Date(prev.getTime()));
    setEditingCell(null);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <WeekNavigationHeader
        currentWeek={currentWeek}
        selectedSide={selectedSide}
        onNavigateWeek={navigateWeek}
        onGoToToday={goToToday}
        onSideChange={setSelectedSide}
      />

      <CapacityCalendarGrid
        currentWeek={currentWeek}
        capacityData={capacityData}
        timeSlots={timeSlots}
        onCellClick={handleCellClick}
      />

      {/* Edit Modal */}
      {editingCell && sideId && (() => {
        const cellData = getCellCapacity(editingCell.date, {
          hour: parseInt(editingCell.time.split(":")[0]),
          minute: parseInt(editingCell.time.split(":")[1]),
        });
        
        const currentSchedule = cellData?.scheduleId ? scheduleData.get(cellData.scheduleId) : null;
        const matchingScheduleIds: number[] = currentSchedule ? [currentSchedule.id] : [];

        const scheduleInfo = currentSchedule ? {
          recurrenceType: currentSchedule.recurrence_type,
          dayOfWeek: currentSchedule.day_of_week,
          startTime: currentSchedule.start_time,
          endTime: currentSchedule.end_time,
          periodType: currentSchedule.period_type,
        } : null;

        return (
          <CapacityEditModal
            isOpen={!!editingCell}
            onClose={() => setEditingCell(null)}
            onSave={handleSaveCapacity}
            onDelete={matchingScheduleIds.length > 0 && scheduleInfo ? () => {
              setDeleteConfirm({
                isOpen: true,
                scheduleIds: matchingScheduleIds,
                selectedDate: editingCell.date,
                scheduleInfo,
              });
              setDeleteMode("single");
            } : undefined}
            initialDate={editingCell.date}
            initialTime={cellData?.startTime || editingCell.time}
            initialEndTime={cellData?.endTime}
            sideId={sideId}
            existingCapacity={cellData ? {
              capacity: cellData.capacity,
              periodType: cellData.periodType as PeriodType,
            } : null}
            existingRecurrenceType={cellData?.recurrenceType as RecurrenceType | undefined}
          />
        );
      })()}

      <DeleteScheduleDialog
        isOpen={deleteConfirm.isOpen}
        selectedDate={deleteConfirm.selectedDate}
        scheduleInfo={deleteConfirm.scheduleInfo}
        deleteMode={deleteMode}
        deleting={deleting}
        onDeleteModeChange={setDeleteMode}
        onConfirm={() => confirmDeleteSchedule(handleDeleteSuccess)}
        onCancel={() => setDeleteConfirm({ isOpen: false, scheduleIds: [], selectedDate: null, scheduleInfo: null })}
      />
    </div>
  );
}
