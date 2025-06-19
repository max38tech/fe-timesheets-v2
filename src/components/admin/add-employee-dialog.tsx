
"use client";

import React, { useState } from 'react';
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
import { db, auth } from '@/lib/firebase'; 
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { FirebaseError } from 'firebase/app'; 
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const employeeProfileSchema = z.object({
  displayName: z.string().min(1, { message: "Display name is required." }).max(100),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Please confirm the password." }),
  role: z.enum(["technician", "admin"], { required_error: "Role is required." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], 
});

type EmployeeProfileFormValues = z.infer<typeof employeeProfileSchema>;

interface AddEmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEmployeeAdded: () => void;
}

export function AddEmployeeDialog({ isOpen, onOpenChange, onEmployeeAdded }: AddEmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<EmployeeProfileFormValues>({
    resolver: zodResolver(employeeProfileSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: undefined,
    },
  });

  const onSubmit: SubmitHandler<EmployeeProfileFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;

      const userDocRef = doc(db, 'users', newUser.uid);
      await setDoc(userDocRef, {
        displayName: data.displayName,
        email: data.email, 
        role: data.role,
        status: "active", // Set initial status to active
      });

      toast({
        title: "Employee Added Successfully",
        description: `User ${data.displayName} (${data.email}) created and profile saved.`,
      });
      onEmployeeAdded();
      reset();
      onOpenChange(false);
    } catch (error) {
      const authError = error as AuthError;
      let friendlyMessage = "Could not add employee. Please try again.";
      // Handle known Firebase Auth errors
      if (authError.code) {
        if (authError.code === 'auth/email-already-in-use') {
          friendlyMessage = 'This email address is already in use. Please use a different email.';
          setError("email", { type: "manual", message: friendlyMessage });
          setIsSubmitting(false);
          return; // Stop further execution
        }
        if (authError.code === 'auth/weak-password') {
          friendlyMessage = 'The password is too weak. It must be at least 6 characters long.';
          setError("password", { type: "manual", message: friendlyMessage });
          setIsSubmitting(false);
          return;
        }
        if (authError.code === 'auth/invalid-email') {
          friendlyMessage = 'The email address is not valid.';
          setError("email", { type: "manual", message: friendlyMessage });
          setIsSubmitting(false);
          return;
        }
        // Fallback for other errors
        friendlyMessage = `An error occurred: ${authError.message}`;
      }
      console.error("Error adding employee:", authError);
      toast({
        title: "Error Adding Employee",
        description: friendlyMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Fill in the details for the new employee. This will create their login credentials and application profile with an 'active' status.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="mt-4 bg-primary/5 border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-semibold">Employee Creation Process</AlertTitle>
          <AlertDescription className="text-xs">
            This form will create the employee's login account in Firebase Authentication and their profile in the application database.
            The employee can change their password later if needed.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="displayName_add_employee_dialog" className="mb-1 block">Display Name</Label>
            <Input
              id="displayName_add_employee_dialog"
              {...register("displayName")}
              placeholder="e.g., Jane Doe"
              className={errors.displayName ? "border-destructive" : ""}
            />
            {errors.displayName && <p className="text-sm text-destructive mt-1">{errors.displayName.message}</p>}
          </div>
          <div>
            <Label htmlFor="email_add_employee_dialog" className="mb-1 block">Email Address (Login)</Label>
            <Input
              id="email_add_employee_dialog"
              type="email"
              {...register("email")}
              placeholder="e.g., user@example.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password_add_employee_dialog_new" className="mb-1 block">Password</Label>
            <Input
              id="password_add_employee_dialog_new"
              type="password"
              {...register("password")}
              placeholder="Min. 6 characters"
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
          </div>
           <div>
            <Label htmlFor="confirmPassword_add_employee_dialog_new" className="mb-1 block">Confirm Password</Label>
            <Input
              id="confirmPassword_add_employee_dialog_new"
              type="password"
              {...register("confirmPassword")}
              placeholder="Re-enter password"
              className={errors.confirmPassword ? "border-destructive" : ""}
            />
            {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="role_add_employee_dialog" className="mb-1 block">Role</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger id="role_add_employee_dialog" className={errors.role ? "border-destructive" : ""}>
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
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Adding Employee..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    