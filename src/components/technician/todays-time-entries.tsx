
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Clock, Loader2, AlertTriangle, Edit3, Trash2, Lock } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn, formatDuration } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, type Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { EditTechnicianTimeEntryDialog } from './edit-technician-time-entry-dialog'; // Import the new dialog

interface Client {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface TodaysTimeEntriesProps {
  technicianId: string;
  selectedClient: Client | null;
  selectedLocation: Location | null;
}

export interface TimeEntry { // Exporting for use in the dialog
  id: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  totalBreakDurationSeconds: number;
  workDurationSeconds: number;
  taskNotes?: string;
  // For dialog context, we'll add these if available when selecting an entry
  clientId?: string;
  locationId?: string;
  clientName?: string;
  locationName?: string;
  technicianId?: string;
  entryDate?: string; // YYYY-MM-DD string for the original entry date
}

export function TodaysTimeEntries({ technicianId, selectedClient, selectedLocation }: TodaysTimeEntriesProps) {
  const [displayDate, setDisplayDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [jobSubmissionStatus, setJobSubmissionStatus] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [entryToEdit, setEntryToEdit] = useState<TimeEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchJobSubmissionStatusAndEntries = async () => {
    if (!technicianId || !selectedClient || !selectedLocation || !displayDate) {
      setTimeEntries([]);
      setJobSubmissionStatus(null);
      return;
    }

    setIsLoading(true);
    setIsLoadingStatus(true);
    setError(null);
    setJobSubmissionStatus(null);

    const formattedDate = format(displayDate, 'yyyy-MM-dd');
    const dayStart = startOfDay(displayDate);
    const dayEnd = endOfDay(displayDate);

    try {
      // Fetch Job Submission Status
      const submissionsRef = collection(db, 'jobSubmissions');
      const statusQuery = query(
        submissionsRef,
        where('technicianId', '==', technicianId),
        where('clientId', '==', selectedClient.id),
        where('locationId', '==', selectedLocation.id),
        where('submittedAt', '>=', dayStart),
        where('submittedAt', '<=', dayEnd),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const statusSnapshot = await getDocs(statusQuery);
      if (!statusSnapshot.empty) {
        setJobSubmissionStatus(statusSnapshot.docs[0].data().status as string);
      } else {
        setJobSubmissionStatus(null); // No submission found for this day/job
      }
    } catch (err) {
      console.error("Error fetching job submission status:", err);
      // Don't block time entry fetching for status error, but inform user
      toast({ title: "Status Check Failed", description: "Could not verify submission status for edit/delete actions.", variant: "destructive" });
    } finally {
      setIsLoadingStatus(false);
    }

    try {
      // Fetch Time Entries
      const timeEntriesRef = collection(db, 'timeEntries');
      const entriesQuery = query(
        timeEntriesRef,
        where('technicianId', '==', technicianId),
        where('clientId', '==', selectedClient.id),
        where('locationId', '==', selectedLocation.id),
        where('entryDate', '==', formattedDate),
        orderBy('startTime', 'asc')
      );

      const querySnapshot = await getDocs(entriesQuery);
      console.log('Raw query snapshot:', querySnapshot.docs.map(d => ({ id: d.id, data: d.data() })));
      
      const fetchedEntries = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Processing entry:', { id: doc.id, data });
        return {
          id: doc.id,
          startTime: data.startTime as string,
          endTime: data.endTime as string,
          totalBreakDurationSeconds: data.totalBreakDurationSeconds as number || 0,
          workDurationSeconds: data.workDurationSeconds as number || 0,
          taskNotes: data.taskNotes as string | undefined,
          // Add client/location/tech info for the edit dialog context
          clientId: selectedClient.id,
          locationId: selectedLocation.id,
          clientName: selectedClient.name,
          locationName: selectedLocation.name,
          technicianId: technicianId,
          entryDate: formattedDate, // Pass the original entry date string
        };
      });
      setTimeEntries(fetchedEntries);
      if (fetchedEntries.length === 0 && !isLoadingStatus) { // Only toast if status check is also done or not critical
         toast({ title: "No Entries", description: `No time entries found for ${selectedClient.name} at ${selectedLocation.name} on ${format(displayDate, 'MMM d, yyyy')}.`})
      }
    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      setError("Failed to load time entries. Ensure Firestore indexes are set up or try again.");
      toast({ title: "Error Loading Entries", description: "Could not fetch time entries.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchJobSubmissionStatusAndEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicianId, selectedClient, selectedLocation, displayDate]);


  const handleOpenDeleteDialog = (entry: TimeEntry) => {
    setEntryToDelete(entry);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'timeEntries', entryToDelete.id));
      toast({ title: "Entry Deleted", description: "Time entry successfully deleted." });
      fetchJobSubmissionStatusAndEntries(); // Refresh list
    } catch (err) {
      console.error("Error deleting time entry:", err);
      toast({ title: "Delete Failed", description: "Could not delete time entry.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setIsConfirmDeleteOpen(false);
      setEntryToDelete(null);
    }
  };

  const handleOpenEditDialog = (entry: TimeEntry) => {
    setEntryToEdit(entry);
    setIsEditDialogOpen(true);
  };

  const isApproved = jobSubmissionStatus === 'approved';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Daily Time Log
        </CardTitle>
        <CardDescription>
          Review your time entries for {selectedClient?.name || 'the selected client'} at {selectedLocation?.name || 'location'} for the chosen date.
          {isApproved && <span className="ml-2 text-xs font-semibold text-primary">(Approved - Entries Locked)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="displayDateLog">Date to View</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="displayDateLog"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !displayDate && "text-muted-foreground"
                )}
                disabled={!selectedClient || !selectedLocation || isLoading || isLoadingStatus}
                onClick={() => setIsCalendarOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayDate ? format(displayDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={displayDate}
                onSelect={(date) => {
                    setDisplayDate(date);
                    setIsCalendarOpen(false);
                }}
                initialFocus
                disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {(isLoading || isLoadingStatus) ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-sm text-muted-foreground">Loading entries & status...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-destructive">
            <AlertTriangle className="h-6 w-6 mb-1" />
            <p className="text-sm font-semibold">Error Loading Entries</p>
            <p className="text-xs text-center">{error}</p>
          </div>
        ) : timeEntries.length > 0 ? (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Break</TableHead>
                    <TableHead className="text-right">Work Duration</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.startTime ? format(parseISO(entry.startTime), 'HH:mm:ss') : 'N/A'}</TableCell>
                      <TableCell>{entry.endTime ? format(parseISO(entry.endTime), 'HH:mm:ss') : 'N/A'}</TableCell>
                      <TableCell className="text-right">{formatDuration(entry.totalBreakDurationSeconds)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDuration(entry.workDurationSeconds)}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenEditDialog(entry)}
                              disabled={isApproved || isDeleting}
                              className={cn("h-7 w-7 p-0", isApproved ? "cursor-not-allowed opacity-50" : "hover:text-primary")}
                            >
                              {isApproved ? <Lock className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          {isApproved && <TooltipContent><p>Approved entries cannot be edited.</p></TooltipContent>}
                        </Tooltip>
                         <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenDeleteDialog(entry)}
                              disabled={isApproved || isDeleting}
                              className={cn("h-7 w-7 p-0", isApproved ? "cursor-not-allowed opacity-50" : "hover:text-destructive")}
                            >
                               {isApproved ? <Lock className="h-4 w-4" /> : (isDeleting && entryToDelete?.id === entry.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />)}
                            </Button>
                          </TooltipTrigger>
                           {isApproved && <TooltipContent><p>Approved entries cannot be deleted.</p></TooltipContent>}
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            {!selectedClient || !selectedLocation ? "Select a client and location to view time entries." : 
             displayDate ? "No time entries found for this selection." : "Select a date to view entries."}
          </p>
        )}
      </CardContent>
      {entryToDelete && (
        <ConfirmDeleteDialog
          isOpen={isConfirmDeleteOpen}
          onOpenChange={setIsConfirmDeleteOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete Time Entry"
          description={`Are you sure you want to delete this time entry? (${formatDuration(entryToDelete.workDurationSeconds)}). This action cannot be undone.`}
          isLoading={isDeleting}
        />
      )}
      {entryToEdit && (
        <EditTechnicianTimeEntryDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          timeEntry={entryToEdit}
          onTimeEntryUpdated={() => {
            setIsEditDialogOpen(false);
            setEntryToEdit(null);
            fetchJobSubmissionStatusAndEntries(); // Refresh list
          }}
        />
      )}
    </Card>
  );
}
