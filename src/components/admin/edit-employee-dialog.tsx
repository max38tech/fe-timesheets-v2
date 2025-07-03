
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { EmployeeProfile } from '@/app/admin/employees/page'; // Import type

const editEmployeeSchema = z.object({
  displayName: z.string().min(1, { message: "Display name is required." }).max(100),
  email: z.string().email({ message: "Invalid email address." }), // Will be read-only
  role: z.enum(["technician", "admin"], { required_error: "Role is required." }),
  status: z.enum(["active", "archived"], { required_error: "Status is required."}),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>;

interface EditEmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeProfile | null;
  onEmployeeUpdated: () => void;
}

export function EditEmployeeDialog({ isOpen, onOpenChange, employee, onEmployeeUpdated }: EditEmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
  });

  useEffect(() => {
    if (employee && isOpen) {
      setValue("displayName", employee.displayName || "");
      setValue("email", employee.email || "");
      setValue("role", employee.role as "technician" | "admin" || undefined);
      setValue("status", employee.status || "active"); // Default to 'active' if somehow undefined
    } else if (!isOpen) {
      reset({ displayName: "", email: "", role: undefined, status: "active" }); // Reset form when dialog is closed
    }
  }, [employee, isOpen, setValue, reset]);

  const onSubmit: SubmitHandler<EditEmployeeFormValues> = async (data) => {
    if (!employee) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', employee.uid);
      await updateDoc(userDocRef, {
        displayName: data.displayName,
        // email is not updated as it's tied to Firebase Auth
        role: data.role,
        status: data.status,
      });

      toast({
        title: "Employee Profile Updated",
        description: `Profile and status for ${data.displayName} have been updated.`,
      });
      onEmployeeUpdated();
      onOpenChange(false); 
    } catch (error) {
      console.error("Error updating employee profile:", error);
      toast({
        title: "Error Updating Profile",
        description: "Could not update employee profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      reset({ displayName: "", email: "", role: undefined, status: "active" }); 
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Employee Profile</DialogTitle>
          <DialogDescription>
            Update the details and status for {employee?.displayName || employee?.email}.
          </DialogDescription>
        </DialogHeader>
        {employee && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="editDisplayName">Display Name</Label>
              <Input
                id="editDisplayName"
                {...register("displayName")}
                className={errors.displayName ? "border-destructive" : ""}
              />
              {errors.displayName && <p className="text-sm text-destructive mt-1">{errors.displayName.message}</p>}
            </div>
            <div>
              <Label htmlFor="editEmail">Email Address (Read-only)</Label>
              <Input
                id="editEmail"
                type="email"
                {...register("email")}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
               {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    defaultValue={field.value} 
                  >
                    <SelectTrigger id="editRole" className={errors.role ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
            </div>
             <div>
              <Label htmlFor="editStatus">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    defaultValue={field.value}
                  >
                    <SelectTrigger id="editStatus" className={errors.status ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
            </div>
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
