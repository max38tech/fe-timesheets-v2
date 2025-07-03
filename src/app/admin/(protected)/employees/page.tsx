
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, PlusCircle, Loader2, AlertTriangle, Edit3, Archive, Undo, Eye, KeyRound } from "lucide-react";
import { db, auth } from '@/lib/firebase'; // Added auth
import { collection, getDocs, query, orderBy, type DocumentData, doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import { useToast } from '@/hooks/use-toast';
import { AddEmployeeDialog } from '@/components/admin/add-employee-dialog';
import { EditEmployeeDialog } from '@/components/admin/edit-employee-dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface EmployeeProfile {
  uid: string;
  displayName?: string;
  email?: string;
  role?: 'admin' | 'technician' | string;
  status?: 'active' | 'archived';
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [isEditEmployeeDialogOpen, setIsEditEmployeeDialogOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeProfile | null>(null);
  const { toast } = useToast();

  const [isConfirmArchiveDialogOpen, setIsConfirmArchiveDialogOpen] = useState(false);
  const [employeeToArchive, setEmployeeToArchive] = useState<EmployeeProfile | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const [isConfirmRestoreDialogOpen, setIsConfirmRestoreDialogOpen] = useState(false);
  const [employeeToRestore, setEmployeeToRestore] = useState<EmployeeProfile | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState<string | null>(null); // Store UID of user for whom reset is being sent

  const fetchEmployees = useCallback(async (currentViewMode: 'active' | 'archived') => {
    setIsLoading(true);
    setError(null);
    try {
      const usersCollectionRef = collection(db, 'users');
      // Simpler query: fetch all and then filter, default status if missing.
      const q = query(usersCollectionRef, orderBy('email'));
      const querySnapshot = await getDocs(q);
      
      const allEmployeesData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          uid: docSnapshot.id,
          displayName: data.displayName as string || undefined,
          email: data.email as string || undefined,
          role: data.role as EmployeeProfile['role'] || undefined,
          status: data.status as EmployeeProfile['status'] || 'active', // Default to 'active' if status is missing
        };
      });

      if (currentViewMode === 'active') {
        setEmployees(allEmployeesData.filter(emp => emp.status !== 'archived'));
      } else { // 'archived'
        setEmployees(allEmployeesData.filter(emp => emp.status === 'archived'));
      }

    } catch (err: any) {
      console.error("Error fetching employees:", err);
      let detailedError = "Failed to load employee profiles. Please try again.";
      if (err.code && err.code.includes('failed-precondition') && err.message.toLowerCase().includes('index')) {
        detailedError = "The query may require a Firestore index (e.g., on 'email'). Please check the console for a link to create it.";
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
    fetchEmployees(viewMode);
  }, [fetchEmployees, viewMode]);

  const handleEmployeeAddedOrUpdated = () => {
    fetchEmployees(viewMode); 
  };

  const handleOpenEditEmployeeDialog = (employee: EmployeeProfile) => {
    setEmployeeToEdit(employee);
    setIsEditEmployeeDialogOpen(true);
  };

  const handleOpenArchiveEmployeeDialog = (employee: EmployeeProfile) => {
    setEmployeeToArchive(employee);
    setIsConfirmArchiveDialogOpen(true);
  };

  const handleArchiveEmployeeConfirm = async () => {
    if (!employeeToArchive) return;
    setIsArchiving(true);
    try {
      const userRef = doc(db, 'users', employeeToArchive.uid);
      await updateDoc(userRef, { status: 'archived' });
      toast({
        title: "Employee Profile Archived",
        description: `Profile for ${employeeToArchive.displayName || employeeToArchive.email} has been archived.`,
      });
      fetchEmployees(viewMode); 
      setIsConfirmArchiveDialogOpen(false);
      setEmployeeToArchive(null);
    } catch (error) {
      console.error("Error archiving employee profile:", error);
      toast({
        title: "Error Archiving Profile",
        description: "Could not archive employee profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleOpenRestoreEmployeeDialog = (employee: EmployeeProfile) => {
    setEmployeeToRestore(employee);
    setIsConfirmRestoreDialogOpen(true);
  };

  const handleRestoreEmployeeConfirm = async () => {
    if (!employeeToRestore) return;
    setIsRestoring(true);
    try {
      const userRef = doc(db, 'users', employeeToRestore.uid);
      await updateDoc(userRef, { status: 'active' });
      toast({
        title: "Employee Profile Restored",
        description: `Profile for ${employeeToRestore.displayName || employeeToRestore.email} has been restored to active.`,
      });
      fetchEmployees(viewMode); 
      setIsConfirmRestoreDialogOpen(false);
      setEmployeeToRestore(null);
    } catch (error) {
      console.error("Error restoring employee profile:", error);
      toast({
        title: "Error Restoring Profile",
        description: "Could not restore employee profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePasswordReset = async (employee: EmployeeProfile) => {
    if (!employee.email) {
      toast({ title: "Error", description: "Employee email is not available.", variant: "destructive" });
      return;
    }
    if (window.confirm(`Are you sure you want to send a password reset email to ${employee.email}?`)) {
      setIsSendingPasswordReset(employee.uid);
      try {
        await sendPasswordResetEmail(auth, employee.email);
        toast({
          title: "Password Reset Email Sent",
          description: `An email has been sent to ${employee.email} with instructions to reset their password.`,
        });
      } catch (error: any) {
        console.error("Error sending password reset email:", error);
        let errorMessage = "Could not send password reset email. Please try again.";
        if (error.code === 'auth/user-not-found') {
          errorMessage = "This email address is not registered in Firebase Authentication.";
        }
        toast({
          title: "Error Sending Email",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsSendingPasswordReset(null);
      }
    }
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'default';
      case 'technician':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Employee Management
        </h1>
        <Button onClick={() => setIsAddEmployeeDialogOpen(true)} size="lg">
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Employee Profile
        </Button>
      </div>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'active' | 'archived')} className="mb-6">
        <TabsList>
          <TabsTrigger value="active">
            <Eye className="mr-2 h-4 w-4" /> Active Employees
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="mr-2 h-4 w-4" /> Archived Employees
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>
            {viewMode === 'active' ? 'Active Employee Roster' : 'Archived Employee Roster'}
          </CardTitle>
          <CardDescription>
            {viewMode === 'active' 
              ? 'View and manage active employee profiles.' 
              : 'View and restore archived employee profiles.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading employee profiles...</p>
            </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Employee Profiles</p>
              <p className="text-sm text-center max-w-md">{error}</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {viewMode === 'active' 
                  ? 'No active employee profiles found. Click "Add Employee Profile" to get started.'
                  : 'No archived employee profiles found.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.uid}>
                    <TableCell className="font-medium">{employee.displayName || 'N/A'}</TableCell>
                    <TableCell>{employee.email || 'N/A'}</TableCell>
                    <TableCell>
                      {employee.role ? (
                        <Badge variant={getRoleBadgeVariant(employee.role)}>
                          {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                        </Badge>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'archived' ? 'outline' : 'default'}>
                        {employee.status ? (employee.status.charAt(0).toUpperCase() + employee.status.slice(1)) : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {viewMode === 'active' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenEditEmployeeDialog(employee)}
                            disabled={isArchiving || isRestoring || !!isSendingPasswordReset}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePasswordReset(employee)}
                            disabled={isSendingPasswordReset === employee.uid || isArchiving || isRestoring}
                            className="w-[150px]" // Give it a bit more width
                          >
                            {isSendingPasswordReset === employee.uid ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <KeyRound className="mr-2 h-4 w-4" />
                            )}
                            {isSendingPasswordReset === employee.uid ? 'Sending...' : 'Reset Password'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenArchiveEmployeeDialog(employee)}
                            disabled={(isArchiving && employeeToArchive?.uid === employee.uid) || !!isSendingPasswordReset}
                          >
                            <Archive className="mr-2 h-4 w-4" /> 
                            Archive
                          </Button>
                        </>
                      )}
                       {viewMode === 'archived' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRestoreEmployeeDialog(employee)}
                            disabled={(isRestoring && employeeToRestore?.uid === employee.uid) || !!isSendingPasswordReset}
                          >
                            <Undo className="mr-2 h-4 w-4" /> 
                            Restore
                          </Button>
                       )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <AddEmployeeDialog
        isOpen={isAddEmployeeDialogOpen}
        onOpenChange={setIsAddEmployeeDialogOpen}
        onEmployeeAdded={handleEmployeeAddedOrUpdated}
      />
      {employeeToEdit && (
        <EditEmployeeDialog
          isOpen={isEditEmployeeDialogOpen}
          onOpenChange={setIsEditEmployeeDialogOpen}
          employee={employeeToEdit}
          onEmployeeUpdated={() => {
            setEmployeeToEdit(null); 
            handleEmployeeAddedOrUpdated();
          }}
        />
      )}
      {employeeToArchive && (
        <ConfirmDeleteDialog
          isOpen={isConfirmArchiveDialogOpen}
          onOpenChange={setIsConfirmArchiveDialogOpen}
          onConfirm={handleArchiveEmployeeConfirm}
          title={`Archive Employee: ${employeeToArchive.displayName || employeeToArchive.email}?`}
          description="Are you sure you want to archive this employee's profile? They will no longer be able to log in, but their historical data will be preserved. This action can be reversed."
          confirmButtonText="Archive"
          confirmButtonVariant="destructive"
          isLoading={isArchiving}
        />
      )}
      {employeeToRestore && (
        <ConfirmDeleteDialog
          isOpen={isConfirmRestoreDialogOpen}
          onOpenChange={setIsConfirmRestoreDialogOpen}
          onConfirm={handleRestoreEmployeeConfirm}
          title={`Restore Employee: ${employeeToRestore.displayName || employeeToRestore.email}?`}
          description="Are you sure you want to restore this employee's profile? They will be able to log in again and will appear in active lists."
          confirmButtonText="Restore"
          confirmButtonVariant="default"
          isLoading={isRestoring}
        />
      )}
    </div>
  );
}
