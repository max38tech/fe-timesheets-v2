
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Hourglass, ArrowRight } from "lucide-react";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, type Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import type { JobSubmission } from '@/app/admin/approvals/page'; // Reusing the interface

const MAX_PREVIEW_ITEMS = 5;

export function RecentSubmissionsPreview() {
  const [submissions, setSubmissions] = useState<JobSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const submissionsCollectionRef = collection(db, 'jobSubmissions');
        const q = query(
          submissionsCollectionRef,
          where('status', '==', 'pending_approval'),
          orderBy('submittedAt', 'desc'),
          limit(MAX_PREVIEW_ITEMS)
        );
        const querySnapshot = await getDocs(q);
        
        const fetchedSubmissions = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const submittedAtTimestamp = data.submittedAt as Timestamp | undefined;
          return {
            id: doc.id,
            clientName: data.clientName || 'N/A',
            locationName: data.locationName || 'N/A', // Not displayed in preview but good to fetch
            technicianEmail: data.technicianEmail || 'N/A',
            taskNotes: data.taskNotes || '', // Not displayed in preview
            status: data.status || 'unknown',
            submittedAt: submittedAtTimestamp ? submittedAtTimestamp.toDate() : null,
          };
        });
        setSubmissions(fetchedSubmissions);
      } catch (err) {
        console.error("Error fetching recent pending submissions:", err);
        setError("Failed to load recent submissions. Ensure Firestore index on jobSubmissions for status (== 'pending_approval') and submittedAt (desc) exists.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  return (
    <Card className="shadow-md h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="h-6 w-6 text-primary" />
          Recent Pending Submissions
        </CardTitle>
        <CardDescription>Quick view of work orders awaiting approval.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-destructive">
            <AlertTriangle className="h-6 w-6 mb-1" />
            <p className="text-sm font-semibold">Error Loading</p>
            <p className="text-xs text-center">{error}</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No pending submissions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium truncate max-w-[100px] sm:max-w-[120px]">{submission.clientName}</TableCell>
                    <TableCell className="truncate max-w-[100px] sm:max-w-[120px]">{submission.technicianEmail}</TableCell>
                    <TableCell className="text-right">
                      {submission.submittedAt 
                        ? format(submission.submittedAt, 'MMM d, HH:mm') 
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Link href="/admin/approvals">
              <Button variant="outline" size="sm" className="w-full">
                <span>
                  View All Approvals <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
