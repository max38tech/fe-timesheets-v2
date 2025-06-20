"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, AlertTriangle, Eye, Edit3 } from "lucide-react";
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  type Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { formatDuration } from '@/lib/utils';
import { EditTechnicianTimeEntryDialog } from './edit-technician-time-entry-dialog';

interface ClientData {
  name: string;
  [key: string]: any;
}

interface LocationData {
  name: string;
  [key: string]: any;
}

interface TimeEntry {
  id: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  workDurationSeconds: number;
  totalBreakDurationSeconds: number;
  clientId: string;
  locationId: string;
  technicianId: string;
  clientName: string;
  locationName: string;
  taskNotes?: string;
}

type FirestoreTimeEntry = Omit<TimeEntry, 'id' | 'clientName' | 'locationName'>;

export function MyTimeEntries({ technicianId }: { technicianId: string }) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchTimeEntries = async () => {
    if (!technicianId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const timeEntriesRef = collection(db, 'timeEntries');
      const q = query(
        timeEntriesRef,
        where('technicianId', '==', technicianId),
        orderBy('entryDate', 'desc'),
        orderBy('startTime', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const entries = await Promise.all(querySnapshot.docs.map(async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnapshot.data() as FirestoreTimeEntry;
        console.log('Time entry data:', data); // Add logging to debug
        
        // Fetch client and location details
        let clientName = 'Unknown Client';
        let locationName = 'Unknown Location';
        
        try {
          if (data.clientId) {
            const clientRef = doc(db, 'clients', data.clientId);
            const clientDoc: DocumentSnapshot<DocumentData> = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data() as ClientData;
              clientName = clientData.name;
            }
          }
          
          if (data.locationId) {
            const locationRef = doc(db, 'locations', data.locationId);
            const locationDoc: DocumentSnapshot<DocumentData> = await getDoc(locationRef);
            if (locationDoc.exists()) {
              const locationData = locationDoc.data() as LocationData;
              locationName = locationData.name;
            }
          }
        } catch (error) {
          console.error('Error fetching client/location details:', error);
        }

        const entry = {
          id: docSnapshot.id,
          ...data,
          clientName,
          locationName,
          taskNotes: data.taskNotes
        };
        
        console.log('Processed entry:', entry); // Add logging to debug
        return entry as TimeEntry;
      }));
      
      setTimeEntries(entries);
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError('Failed to load your time entries. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [technicianId]);

  const handleEdit = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setIsEditDialogOpen(true);
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          My Time Entries
        </CardTitle>
        <CardDescription>View and manage your submitted time entries</CardDescription>
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
            <p className="text-muted-foreground">No time entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Work Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(parseISO(entry.entryDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{entry.clientName}</TableCell>
                    <TableCell>{entry.locationName}</TableCell>
                    <TableCell>{format(parseISO(entry.startTime), 'HH:mm')}</TableCell>
                    <TableCell>{format(parseISO(entry.endTime), 'HH:mm')}</TableCell>
                    <TableCell>{formatDuration(entry.totalBreakDurationSeconds)}</TableCell>
                    <TableCell>{formatDuration(entry.workDurationSeconds)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(entry)}
                        className="hover:text-primary"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span className="sr-only">Edit time entry</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {selectedEntry && (
        <EditTechnicianTimeEntryDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          timeEntry={selectedEntry}
          onTimeEntryUpdated={() => {
            setIsEditDialogOpen(false);
            fetchTimeEntries();
          }}
        />
      )}
    </Card>
  );
}
