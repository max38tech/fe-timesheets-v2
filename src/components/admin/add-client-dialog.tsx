
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

const clientSchema = z.object({
  name: z.string().min(1, { message: "Client name is required." }).max(100, { message: "Client name must be 100 characters or less." }),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface AddClientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded: () => void;
}

export function AddClientDialog({ isOpen, onOpenChange, onClientAdded }: AddClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  const onSubmit: SubmitHandler<ClientFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const clientsCollectionRef = collection(db, 'clients');
      await addDoc(clientsCollectionRef, {
        name: data.name,
      });
      toast({
        title: "Client Added",
        description: `Client "${data.name}" has been successfully added.`,
      });
      onClientAdded();
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding client:", error);
      toast({
        title: "Error",
        description: "Could not add client. Please try again.",
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
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Enter the name for the new client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="clientName" className="mb-1 block">Client Name</Label>
            <Input
              id="clientName"
              {...register("name")}
              placeholder="e.g., Acme Corporation"
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
              {isSubmitting ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    