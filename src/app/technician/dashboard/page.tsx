
"use client";

import React, { useState, useEffect } from 'react';
import { ClientSelector } from '@/components/technician/client-selector';
import { LocationSelector } from '@/components/technician/location-selector';
import { TimeTracker } from '@/components/technician/time-tracker';
import { TaskLogger } from '@/components/technician/task-logger';
import { SuggestedTasks } from '@/components/technician/suggested-tasks';
import { TodaysTimeEntries } from '@/components/technician/todays-time-entries'; // New Import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Loader2, AlertTriangle, ListChecks, Eye, Clock } from 'lucide-react'; // Added Clock
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, type Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { SubmissionDetailsDialog } from '@/components/admin/submission-details-dialog';

export interface JobSubmission {
  id: string;
  clientName: string;
  locationName: string;
  technicianEmail: string;
  taskNotes: string;
  status: string;
  submittedAt: Date | null;
  clientId?: string;
  locationId?: string;
  technicianId?: string;
}


export default function TechnicianDashboardPage() {
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string } | null>(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [mySubmissions, setMySubmissions] = useState<JobSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<JobSubmission | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const isJobSelected = !!selectedClient && !!selectedLocation;

  const fetchTechnicianSubmissions = async () => {
    if (!currentUser?.uid) {
      setIsLoadingSubmissions(false);
      setMySubmissions([]);
      return;
    }
    setIsLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      const submissionsCollectionRef = collection(db, 'jobSubmissions');
      const q = query(
        submissionsCollectionRef,
        where('technicianId', '==', currentUser.uid),
        orderBy('submittedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const fetchedSubmissions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const submittedAtTimestamp = data.submittedAt as Timestamp | undefined;
        return {
          id: doc.id,
          clientName: data.clientName || 'N/A',
          locationName: data.locationName || 'N/A',
          technicianEmail: data.technicianEmail || 'N/A',
          taskNotes: data.taskNotes || '',
          status: data.status || 'unknown',
          submittedAt: submittedAtTimestamp ? submittedAtTimestamp.toDate() : null,
          clientId: data.clientId,
          locationId: data.locationId,
          technicianId: data.technicianId,
        };
      });
      setMySubmissions(fetchedSubmissions);
    } catch (err) {
      console.error("Error fetching technician's job submissions:", err);
      setSubmissionsError("Failed to load your past submissions. Please try refreshing.");
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchTechnicianSubmissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);


  const handleClientApproval = async () => {
    if (!isJobSelected || !currentUser?.uid || !currentUser?.email) {
      toast({ title: "Action Required", description: "Please select a client, location, and ensure you are logged in.", variant: "destructive" });
      return;
    }
    if (!taskNotes.trim()) {
      toast({ title: "Task Notes Required", description: "Please enter some task notes before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const jobSubmissionsCollectionRef = collection(db, 'jobSubmissions');
      await addDoc(jobSubmissionsCollectionRef, {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
        technicianId: currentUser.uid, 
        technicianEmail: currentUser.email, 
        taskNotes: taskNotes,
        status: 'pending_approval',
        submittedAt: serverTimestamp(),
      });

      toast({ 
        title: "Submission Successful", 
        description: `Work for ${selectedClient?.name} at ${selectedLocation?.name} submitted for approval.` 
      });
      setTaskNotes('');
      fetchTechnicianSubmissions(); // Re-fetch submissions to include the new one
      
    } catch (error) {
      console.error("Error submitting job for approval:", error);
      toast({ 
        title: "Submission Failed", 
        description: "There was an error submitting your work. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
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

  const handleViewDetails = (submission: JobSubmission) => {
    setSelectedSubmission(submission);
    setIsDetailsDialogOpen(true);
  };

  const handleSuggestedTaskSelect = (taskText: string) => {
    setTaskNotes(prevNotes => {
      if (prevNotes.trim() === '') {
        return taskText;
      }
      // Check if the taskText is already the last line
      const lines = prevNotes.split('\n');
      if (lines[lines.length - 1].trim() === taskText.trim()) {
        return prevNotes; // Avoid adding duplicate if it's already the last line
      }
      return `${prevNotes}\n${taskText}`;
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Technician Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Job Selection</CardTitle>
              <CardDescription>Select the client and job location to begin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="client-selector" className="block text-sm font-medium text-muted-foreground mb-1">Client</label>
                <ClientSelector selectedClient={selectedClient} onClientSelect={(client) => {
                  setSelectedClient(client);
                  setSelectedLocation(null); 
                  setTaskNotes(''); 
                }} />
              </div>
              <div>
                <label htmlFor="location-selector" className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
                <LocationSelector 
                  selectedClientId={selectedClient?.id || null} 
                  selectedLocation={selectedLocation} 
                  onLocationSelect={(location) => {
                    setSelectedLocation(location);
                    setTaskNotes(''); 
                  }}
                />
              </div>
            </CardContent>
          </Card>
          
          <TimeTracker 
            isJobSelected={isJobSelected} 
            technicianId={currentUser?.uid || null}
            clientId={selectedClient?.id || null}
            locationId={selectedLocation?.id || null}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <TaskLogger 
            isJobSelected={isJobSelected} 
            notes={taskNotes}
            onNotesChange={setTaskNotes}
          />
          <SuggestedTasks 
            client={selectedClient} 
            location={selectedLocation}
            onTaskSelect={handleSuggestedTaskSelect} 
          />
           {/* New TodaysTimeEntries component */}
          {isJobSelected && currentUser && (
            <TodaysTimeEntries 
              technicianId={currentUser.uid}
              selectedClient={selectedClient}
              selectedLocation={selectedLocation}
            />
          )}
        </div>
      </div>

      <Separator className="my-8" />

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Submit for Approval</CardTitle>
          <CardDescription>Once work is complete, submit your timesheet and tasks for client approval. Time entries are saved automatically when you clock out.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleClientApproval} 
            disabled={!isJobSelected || isSubmitting || !taskNotes.trim() || !currentUser} 
            className="w-full sm:w-auto"
            size="lg"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Send className="mr-2 h-5 w-5" />
            )}
            {isSubmitting ? 'Submitting...' : 'Submit Task Notes for Approval'}
          </Button>
          {!currentUser && <p className="text-xs text-destructive mt-2">You must be logged in to submit.</p>}
           <p className="text-xs text-muted-foreground mt-2">Note: Actual time entries are saved when you clock out via the Time Tracker.</p>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            My Recent Submissions
          </CardTitle>
          <CardDescription>View the status of your recently submitted work orders.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubmissions ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading your submissions...</p>
            </div>
          ) : submissionsError ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Submissions</p>
              <p className="text-sm text-center max-w-md">{submissionsError}</p>
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">You have not submitted any work orders yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.clientName}</TableCell>
                    <TableCell>{submission.locationName}</TableCell>
                    <TableCell>
                      {submission.submittedAt 
                        ? format(submission.submittedAt, 'MMM d, yyyy HH:mm') 
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(submission.status)}>
                        {submission.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(submission)}>
                         <Eye className="mr-2 h-4 w-4" />
                         View Details
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {selectedSubmission && (
        <SubmissionDetailsDialog
          submission={selectedSubmission}
          isOpen={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          isReadOnly={true}
        />
      )}
    </div>
  );
}
    
