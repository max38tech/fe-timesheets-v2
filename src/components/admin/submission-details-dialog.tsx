
"use client";

import type { JobSubmission } from "@/app/admin/approvals/page"; // Use type import
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
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, ThumbsUp, ThumbsDown, AlertTriangle, ClockIcon, Hourglass } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, type Timestamp } from 'firebase/firestore';
import { formatDuration } from '@/lib/utils';

interface TimeEntry {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  totalBreakDurationSeconds: number;
  workDurationSeconds: number;
}

interface SubmissionDetailsDialogProps {
  submission: JobSubmission | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (submissionId: string) => void; // Optional for read-only mode
  onReject?: (submissionId: string) => void;  // Optional for read-only mode
  isUpdating?: boolean;
  isReadOnly?: boolean;
}

export function SubmissionDetailsDialog({
  submission,
  isOpen,
  onOpenChange,
  onApprove,
  onReject,
  isUpdating = false,
  isReadOnly = false,
}: SubmissionDetailsDialogProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [totalWorkDuration, setTotalWorkDuration] = useState<number>(0);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
  const [timeEntriesError, setTimeEntriesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeEntriesAndCalculateTotal = async () => {
      if (!submission || !isOpen) {
        setTimeEntries([]);
        setTotalWorkDuration(0);
        return;
      }
      setIsLoadingTimeEntries(true);
      setTimeEntriesError(null);
      setTotalWorkDuration(0); 
      try {
        if (!submission.technicianId || !submission.clientId || !submission.locationId || !submission.submittedAt) {
          setTimeEntriesError("Submission data is incomplete for fetching time entries. Ensure technician, client, location IDs, and submission date are available.");
          setTimeEntries([]);
          setIsLoadingTimeEntries(false);
          return;
        }

        const submissionDate = format(submission.submittedAt, 'yyyy-MM-dd');
        const timeEntriesCollectionRef = collection(db, 'timeEntries');
        const q = query(
          timeEntriesCollectionRef,
          where('technicianId', '==', submission.technicianId),
          where('clientId', '==', submission.clientId),
          where('locationId', '==', submission.locationId),
          where('entryDate', '==', submissionDate),
          orderBy('startTime', 'asc')
        );
        const querySnapshot = await getDocs(q);
        let currentTotalSeconds = 0;
        const fetchedEntries = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const workSeconds = data.workDurationSeconds || 0;
          currentTotalSeconds += workSeconds;
          return {
            id: doc.id,
            startTime: data.startTime,
            endTime: data.endTime,
            totalBreakDurationSeconds: data.totalBreakDurationSeconds || 0,
            workDurationSeconds: workSeconds,
          };
        });
        setTimeEntries(fetchedEntries);
        setTotalWorkDuration(currentTotalSeconds);
      } catch (err) {
        console.error("Error fetching time entries for dialog:", err);
        setTimeEntriesError("Failed to load associated time entries. Check Firestore indexes (e.g., on timeEntries for technicianId, clientId, locationId, entryDate, startTime) or permissions.");
      } finally {
        setIsLoadingTimeEntries(false);
      }
    };

    if (isOpen) { // Fetch only when dialog is open
        fetchTimeEntriesAndCalculateTotal();
    }
  }, [submission, isOpen]);

  if (!submission) {
    return null;
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending_approval':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submission Details</DialogTitle>
          <DialogDescription>
            Review the details of the job submission {submission.technicianEmail ? `by ${submission.technicianEmail}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Client:</span>
              <span className="col-span-2 text-sm">{submission.clientName || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Location:</span>
              <span className="col-span-2 text-sm">{submission.locationName || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Technician:</span>
              <span className="col-span-2 text-sm">{submission.technicianEmail || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Submitted:</span>
              <span className="col-span-2 text-sm">
                {submission.submittedAt
                  ? format(submission.submittedAt, 'MMM d, yyyy HH:mm')
                  : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className="col-span-2">
                <Badge variant={getStatusBadgeVariant(submission.status)}>
                  {(submission.status || 'UNKNOWN').replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
            </div>

            <Separator className="my-2" />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Task Notes:</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                {submission.taskNotes || "No task notes provided."}
              </p>
            </div>
            
            <Separator className="my-2" />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                <ClockIcon className="mr-2 h-4 w-4" /> Associated Time Entries (for date of submission)
              </h4>
              {isLoadingTimeEntries ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="ml-2 text-sm text-muted-foreground">Loading time entries...</p>
                </div>
              ) : timeEntriesError ? (
                <div className="flex items-center text-destructive py-2 bg-destructive/10 p-3 rounded-md">
                  <AlertTriangle className="mr-2 h-4 w-4 shrink-0" />
                  <p className="text-sm">{timeEntriesError}</p>
                </div>
              ) : (
                <>
                  {timeEntries.length > 0 && (
                     <div className="mb-3 p-3 border rounded-md bg-background flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hourglass className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium text-foreground">Total Work Duration:</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">{formatDuration(totalWorkDuration)}</span>
                      </div>
                  )}
                  {timeEntries.length > 0 ? (
                    <ul className="space-y-3">
                      {timeEntries.map((entry) => (
                        <li key={entry.id} className="text-sm p-3 rounded-md border bg-muted/30">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="font-medium">Start:</span>
                            <span>{entry.startTime ? format(parseISO(entry.startTime), 'MMM d, HH:mm:ss') : 'N/A'}</span>
                            
                            <span className="font-medium">End:</span>
                            <span>{entry.endTime ? format(parseISO(entry.endTime), 'MMM d, HH:mm:ss') : 'N/A'}</span>
                            
                            <span className="font-medium">Break:</span>
                            <span>{formatDuration(entry.totalBreakDurationSeconds)}</span>
                            
                            <span className="font-medium">Work Duration:</span>
                            <span className="font-semibold">{formatDuration(entry.workDurationSeconds)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                     <p className="text-sm text-muted-foreground py-2">No specific time entries found matching this submission's details (technician, client, location, and submission date).</p>
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-between pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isUpdating && !isReadOnly}>
              Close
            </Button>
          </DialogClose>
          {!isReadOnly && submission.status?.toLowerCase() === 'pending_approval' && onApprove && onReject && (
            <div className="flex gap-2 mt-4 sm:mt-0">
              <Button
                type="button"
                variant="destructive"
                onClick={() => onReject(submission.id)}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                Reject
              </Button>
              <Button
                type="button"
                onClick={() => onApprove(submission.id)}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                Approve
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

