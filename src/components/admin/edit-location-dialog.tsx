
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
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const locationSchema = z.object({
  name: z.string().min(1, { message: "Location name is required." }).max(100, { message: "Location name must be 100 characters or less." }),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface Location {
  id: string;
  name: string;
  clientId: string;
}

interface EditLocationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onLocationUpdated: () => void;
}

export function EditLocationDialog({ isOpen, onOpenChange, location, onLocationUpdated }: EditLocationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
  });

  useEffect(() => {
    if (location && isOpen) {
      setValue("name", location.name);
    } else if (!isOpen) {
      reset();
    }
  }, [location, isOpen, setValue, reset]);

  const onSubmit: SubmitHandler<LocationFormValues> = async (data) => {
    if (!location) return;
    setIsSubmitting(true);
    try {
      const locationRef = doc(db, 'locations', location.id);
      await updateDoc(locationRef, {
        name: data.name,
        // clientId remains unchanged
      });
      toast({
        title: "Location Updated",
        description: `Location "${data.name}" has been successfully updated.`,
      });
      onLocationUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating location:", error);
      toast({
        title: "Error",
        description: "Could not update location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>
            Update the name for location: {location?.name}.
          </DialogDescription>
        </DialogHeader>
        {location && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="editLocationName" className="mb-1 block">Location Name</Label>
              <Input
                id="editLocationName"
                {...register("name")}
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
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

    