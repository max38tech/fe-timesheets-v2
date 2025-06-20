
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Loader2, AlertTriangle, Eye, Edit3, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, where, limit, type Timestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { formatDuration } from '@/lib/utils';
import { SubmissionDetailsDialog } from '@/components/admin/submission-details-dialog';

// Define JobSubmission interface to match the one expected by SubmissionDetailsDialog
interface JobSubmission {
  id: string;
  clientId: string;
  clientName: string;
  locationId: string;
  locationName: string;
  technicianId: string;
  technicianEmail?: string;
  taskNotes?: string;
  status?: string;
  submittedAt?: Date;
}
import { Button } from "@/components/ui/button";
import { EditTimeEntryDialog } from '@/components/admin/edit-time-entry-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';

interface RawTimeEntry {
  id: string;
  entryDate: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime: string; // ISO string
  workDurationSeconds: number;
  totalBreakDurationSeconds: number;
  clientId: string;
  locationId: string;
  technicianId: string;
}

export interface EnrichedTimeEntry extends RawTimeEntry {
  clientName: string;
  locationName: string;
  technicianNameOrEmail: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  workDurationFormatted: string;
  breakDurationFormatted: string;
}

export default function TimeEntriesPage() {
  const [timeEntries, setTimeEntries] = useState<EnrichedTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [selectedJobSubmission, setSelectedJobSubmission] = useState<JobSubmission | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isFetchingSubmissionDetails, setIsFetchingSubmissionDetails] = useState(false);

  const [timeEntryToEdit, setTimeEntryToEdit] = useState<EnrichedTimeEntry | null>(null);
  const [isEditTimeEntryDialogOpen, setIsEditTimeEntryDialogOpen] = useState(false);

  const [timeEntryToDelete, setTimeEntryToDelete] = useState<EnrichedTimeEntry | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTimeEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const timeEntriesCollectionRef = collection(db, 'timeEntries');
      const q = query(timeEntriesCollectionRef, orderBy('entryDate', 'desc'), orderBy('startTime', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const fetchedEntries = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      } as RawTimeEntry));

      const enrichedEntries = await Promise.all(
        fetchedEntries.map(async (entry) => {
          let clientName = 'N/A';
          let locationName = 'N/A';
          let technicianNameOrEmail = `User ID: ${entry.technicianId.substring(0,5)}...`;

          try {
            if (entry.clientId) {
              const clientSnap = await getDoc(doc(db, 'clients', entry.clientId));
              clientName = clientSnap.exists() ? clientSnap.data()?.name || 'Client Name Missing' : 'Client Not Found';
            }
            if (entry.locationId) {
              const locationSnap = await getDoc(doc(db, 'locations', entry.locationId));
              locationName = locationSnap.exists() ? locationSnap.data()?.name || 'Location Name Missing' : 'Location Not Found';
            }
            if (entry.technicianId) {
              const userSnap = await getDoc(doc(db, 'users', entry.technicianId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                technicianNameOrEmail = userData?.displayName || userData?.email || `Details missing for user ${entry.technicianId.substring(0,5)}`;
              } else {
                technicianNameOrEmail = `User Doc Not Found: ${entry.technicianId.substring(0,5)}`;
              }
            }
          } catch (lookupError: any) {
            console.error(`Error looking up details for entry ${entry.id}:`, lookupError);
          }
          
          return {
            ...entry,
            clientName,
            locationName,
            technicianNameOrEmail,
            startTimeFormatted: entry.startTime ? format(parseISO(entry.startTime), 'HH:mm:ss') : 'N/A',
            endTimeFormatted: entry.endTime ? format(parseISO(entry.endTime), 'HH:mm:ss') : 'N/A',
            workDurationFormatted: formatDuration(entry.workDurationSeconds),
            breakDurationFormatted: formatDuration(entry.totalBreakDurationSeconds),
          };
        })
      );
      setTimeEntries(enrichedEntries);

    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      let detailedError = "Failed to load time entries. Please try again.";
      if (err.code && (err.code.includes('failed-precondition') || err.message.toLowerCase().includes('index'))) {
        detailedError = "The query requires a Firestore index on 'timeEntries' for 'entryDate' (desc) and 'startTime' (desc). Please create it in the Firebase console.";
        toast({ title: "Index Required", description: detailedError, variant: "destructive", duration: 10000 });
      } else {
        toast({ title: "Error", description: detailedError, variant: "destructive" });
      }
      setError(detailedError);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTimeEntries();
  }, [fetchTimeEntries]);

  const handleViewDetails = async (entry: EnrichedTimeEntry) => {
    setIsFetchingSubmissionDetails(true);
    setSelectedJobSubmission(null);
    try {
      let entryDateObj: Date;
      try {
        entryDateObj = parseISO(entry.entryDate);
        if (!isValid(entryDateObj)) throw new Error('Invalid date format from entry.entryDate');
      } catch (dateParseError: any) {
        console.error("Error parsing entry.entryDate:", entry.entryDate, dateParseError);
        toast({
          title: "Data Error",
          description: `Invalid date found for time entry ${entry.id}. Cannot fetch submission details. ${dateParseError.message}`,
          variant: "destructive",
        });
        setIsFetchingSubmissionDetails(false);
        return;
      }
      
      const dayStart = startOfDay(entryDateObj);
      const dayEnd = endOfDay(entryDateObj);

      const jobSubmissionsRef = collection(db, 'jobSubmissions');
      const q = query(
        jobSubmissionsRef,
        where('technicianId', '==', entry.technicianId),
        where('clientId', '==', entry.clientId),
        where('locationId', '==', entry.locationId),
        where('submittedAt', '>=', dayStart),
        where('submittedAt', '<=', dayEnd),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const submissionDoc = querySnapshot.docs[0];
        const submissionData = submissionDoc.data();
        const submittedAtTimestamp = submissionData.submittedAt as Timestamp | undefined;

        setSelectedJobSubmission({
          id: submissionDoc.id,
          clientName: submissionData.clientName || entry.clientName,
          locationName: submissionData.locationName || entry.locationName,
          technicianEmail: submissionData.technicianEmail || (entry.technicianNameOrEmail.includes('@') ? entry.technicianNameOrEmail : 'N/A'),
          taskNotes: submissionData.taskNotes,
          status: submissionData.status || 'unknown',
          submittedAt: submittedAtTimestamp ? submittedAtTimestamp.toDate() : undefined,
          clientId: submissionData.clientId || entry.clientId,
          locationId: submissionData.locationId || entry.locationId,
          technicianId: submissionData.technicianId || entry.technicianId,
        });
        setIsDetailsDialogOpen(true);
      } else {
        // Create a submission object even if no submission was found
        setSelectedJobSubmission({
          id: 'generated-' + entry.id, // Generate a temporary ID
          clientName: entry.clientName,
          locationName: entry.locationName,
          technicianEmail: entry.technicianNameOrEmail.includes('@') ? entry.technicianNameOrEmail : 'N/A',
          taskNotes: '',
          status: 'unknown',
          submittedAt: undefined,
          clientId: entry.clientId,
          locationId: entry.locationId,
          technicianId: entry.technicianId,
        });
        setIsDetailsDialogOpen(true);
      }
    } catch (err) {
      console.error("Error fetching job submission for details:", err);
      toast({
        title: "Error",
        description: "Could not fetch associated submission details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingSubmissionDetails(false);
    }
  };

  const handleOpenEditDialog = (entry: EnrichedTimeEntry) => {
    setTimeEntryToEdit(entry);
    setIsEditTimeEntryDialogOpen(true);
  };

  const handleOpenDeleteDialog = (entry: EnrichedTimeEntry) => {
    setTimeEntryToDelete(entry);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleDeleteTimeEntryConfirm = async () => {
    if (!timeEntryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'timeEntries', timeEntryToDelete.id));
      toast({
        title: "Time Entry Deleted",
        description: "The time entry has been successfully deleted.",
      });
      fetchTimeEntries(); // Refresh the list
      setIsConfirmDeleteDialogOpen(false);
      setTimeEntryToDelete(null);
    } catch (err) {
      console.error("Error deleting time entry:", err);
      toast({
        title: "Error Deleting Entry",
        description: "Could not delete the time entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-8 w-8 text-primary" />
          All Time Entries
        </h1>
      </div>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recorded Time Entries</CardTitle>
          <CardDescription>View, edit, or delete time entries logged by technicians. Entries are sorted by most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading time entries...</p>
            </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Time Entries</p>
              <p className="text-sm text-center max-w-md">{error}</p>
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No time entries found in the system.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
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
                      <TableCell>{entry.entryDate ? format(parseISO(entry.entryDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                      <TableCell>{entry.technicianNameOrEmail}</TableCell>
                      <TableCell>{entry.clientName}</TableCell>
                      <TableCell>{entry.locationName}</TableCell>
                      <TableCell>{entry.startTimeFormatted}</TableCell>
                      <TableCell>{entry.endTimeFormatted}</TableCell>
                      <TableCell className="text-right">{entry.breakDurationFormatted}</TableCell>
                      <TableCell className="text-right font-medium">{entry.workDurationFormatted}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewDetails(entry)} 
                            disabled={isFetchingSubmissionDetails || isDeleting}
                            aria-label={`View details for time entry on ${entry.entryDate ? format(parseISO(entry.entryDate), 'MMM d, yyyy') : 'N/A'} by ${entry.technicianNameOrEmail}`}
                            className="hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEditDialog(entry)} 
                            disabled={isDeleting}
                            aria-label={`Edit time entry on ${entry.entryDate ? format(parseISO(entry.entryDate), 'MMM d, yyyy') : 'N/A'} by ${entry.technicianNameOrEmail}`}
                            className="hover:text-primary"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenDeleteDialog(entry)} 
                            disabled={isDeleting && timeEntryToDelete?.id === entry.id}
                            aria-label={`Delete time entry on ${entry.entryDate ? format(parseISO(entry.entryDate), 'MMM d, yyyy') : 'N/A'} by ${entry.technicianNameOrEmail}`}
                            className="hover:text-destructive"
                        >
                           {isDeleting && timeEntryToDelete?.id === entry.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedJobSubmission && (
        <SubmissionDetailsDialog
          submission={selectedJobSubmission}
          isOpen={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          isReadOnly={true} 
        />
      )}

      {timeEntryToEdit && (
        <EditTimeEntryDialog
          isOpen={isEditTimeEntryDialogOpen}
          onOpenChange={setIsEditTimeEntryDialogOpen}
          timeEntry={timeEntryToEdit}
          onTimeEntryUpdated={() => {
            setTimeEntryToEdit(null);
            fetchTimeEntries();
          }}
        />
      )}

      {timeEntryToDelete && (
        <ConfirmDeleteDialog
          isOpen={isConfirmDeleteDialogOpen}
          onOpenChange={setIsConfirmDeleteDialogOpen}
          onConfirm={handleDeleteTimeEntryConfirm}
          title="Delete Time Entry"
          description={`Are you sure you want to delete this time entry? (${timeEntryToDelete.workDurationFormatted} for ${timeEntryToDelete.clientName} on ${timeEntryToDelete.entryDate ? format(parseISO(timeEntryToDelete.entryDate), 'MMM d, yyyy') : 'N/A'}). This action cannot be undone.`}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
