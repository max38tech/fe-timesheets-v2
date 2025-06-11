
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle, Eye, Loader2, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, type Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { SubmissionDetailsDialog } from '@/components/admin/submission-details-dialog';
import { useToast } from '@/hooks/use-toast';

export interface JobSubmission {
  id: string;
  clientName: string;
  locationName: string;
  technicianEmail: string;
  taskNotes: string;
  status: string;
  submittedAt: Date | null;
  // Optional fields if they exist in your Firestore document
  clientId?: string;
  locationId?: string;
  technicianId?: string;
}

export default function ApprovalsPage() {
  const [submissions, setSubmissions] = useState<JobSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<JobSubmission | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSubmissions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const submissionsCollectionRef = collection(db, 'jobSubmissions');
        const q = query(submissionsCollectionRef, orderBy('submittedAt', 'desc'));
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
        setSubmissions(fetchedSubmissions);
      } catch (err) {
        console.error("Error fetching job submissions:", err);
        setError("Failed to load job submissions. Ensure Firestore permissions allow reading the 'jobSubmissions' collection or try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

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

  const updateSubmissionStatus = async (submissionId: string, newStatus: 'approved' | 'rejected') => {
    setIsUpdating(true);
    try {
      const submissionRef = doc(db, 'jobSubmissions', submissionId);
      await updateDoc(submissionRef, { status: newStatus });

      setSubmissions(prevSubmissions =>
        prevSubmissions.map(sub =>
          sub.id === submissionId ? { ...sub, status: newStatus } : sub
        )
      );
      toast({
        title: `Submission ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `The submission has been successfully ${newStatus}.`,
      });
      setIsDetailsDialogOpen(false);
      setSelectedSubmission(null); // Clear selection after action
    } catch (err) {
      console.error(`Error ${newStatus === 'approved' ? 'approving' : 'rejecting'} submission:`, err);
      toast({
        title: "Update Failed",
        description: `Could not ${newStatus === 'approved' ? 'approve' : 'reject'} the submission. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = (submissionId: string) => {
    updateSubmissionStatus(submissionId, 'approved');
  };

  const handleReject = (submissionId: string) => {
    updateSubmissionStatus(submissionId, 'rejected');
  };


  return (
    <div className="container mx-auto py-8 px-4">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CheckCircle className="h-8 w-8 text-primary" />
          Job Submissions for Approval
        </h1>
      </div>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Submitted Work Orders</CardTitle>
          <CardDescription>Review timesheets and task details submitted by technicians for client approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Submissions</p>
              <p className="text-sm text-center max-w-md">{error}</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No job submissions found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead> 
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.clientName}</TableCell>
                    <TableCell>{submission.locationName}</TableCell>
                    <TableCell>{submission.technicianEmail}</TableCell>
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
                       <Button variant="outline" size="sm" onClick={() => handleViewDetails(submission)} disabled={isUpdating}>
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
          onApprove={() => handleApprove(selectedSubmission.id)}
          onReject={() => handleReject(selectedSubmission.id)}
          isUpdating={isUpdating} // Pass isUpdating to dialog
        />
      )}
    </div>
  );
}
