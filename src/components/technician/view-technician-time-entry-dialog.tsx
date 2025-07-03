"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeEntry } from "@/components/technician/my-time-entries";

interface ViewTechnicianTimeEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: TimeEntry | null;
}

export function ViewTechnicianTimeEntryDialog({
  isOpen,
  onOpenChange,
  timeEntry,
}: ViewTechnicianTimeEntryDialogProps) {
  if (!timeEntry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>View Time Entry</DialogTitle>
          <DialogDescription>
            View details of your submitted time entry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <strong>Date:</strong> {timeEntry.entryDate}
          </div>
          <div>
            <strong>Client:</strong> {timeEntry.clientName}
          </div>
          <div>
            <strong>Location:</strong> {timeEntry.locationName}
          </div>
          <div>
            <strong>Start Time:</strong> {timeEntry.startTime}
          </div>
          <div>
            <strong>End Time:</strong> {timeEntry.endTime}
          </div>
          <div>
            <strong>Break Duration:</strong> {timeEntry.totalBreakDurationSeconds} seconds
          </div>
          <div>
            <strong>Work Duration:</strong> {timeEntry.workDurationSeconds} seconds
          </div>
          <div>
            <strong>Task Notes:</strong> {timeEntry.taskNotes || "None"}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
