
"use client";

import React, { useState, useEffect } from 'react';
import { ClientSelector } from '@/components/technician/client-selector';
import { LocationSelector } from '@/components/technician/location-selector';
import { TimeTracker } from '@/components/technician/time-tracker';
import { TaskLogger } from '@/components/technician/task-logger';
import { TodaysTimeEntries } from '@/components/technician/todays-time-entries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Loader2, AlertTriangle, ListChecks, Eye, Clock } from 'lucide-react';
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
      fetchTechnicianSubmissions();
      
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
      {/* Submit and submissions table unchanged */}
    </div>
  );
}