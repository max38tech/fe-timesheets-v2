
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
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const locationSchema = z.object({
  name: z.string().min(1, { message: "Location name is required." }).max(100, { message: "Location name must be 100 characters or less." }),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface AddLocationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onLocationAdded: (clientId: string) => void;
}

export function AddLocationDialog({ 
  isOpen, 
  onOpenChange, 
  clientId, 
  clientName, 
  onLocationAdded 
}: AddLocationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
  });

  const onSubmit: SubmitHandler<LocationFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const locationsCollectionRef = collection(db, 'locations');
      await addDoc(locationsCollectionRef, {
        name: data.name,
        clientId: clientId,
      });
      toast({
        title: "Location Added",
        description: `Location "${data.name}" has been successfully added for ${clientName}.`,
      });
      onLocationAdded(clientId);
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding location:", error);
      toast({
        title: "Error",
        description: "Could not add location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form when dialog is closed or opened
  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Location for {clientName}</DialogTitle>
          <DialogDescription>
            Enter the name for the new location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="locationName" className="mb-1 block">Location Name</Label>
            <Input
              id="locationName"
              {...register("name")}
              placeholder="e.g., Main Street Site"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    