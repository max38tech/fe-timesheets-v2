
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

const clientSchema = z.object({
  name: z.string().min(1, { message: "Client name is required." }).max(100, { message: "Client name must be 100 characters or less." }),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface Client {
  id: string;
  name: string;
}

interface EditClientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onClientUpdated: () => void;
}

export function EditClientDialog({ isOpen, onOpenChange, client, onClientUpdated }: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    if (client && isOpen) {
      setValue("name", client.name);
    } else if (!isOpen) {
      reset(); // Reset form when dialog is closed
    }
  }, [client, isOpen, setValue, reset]);

  const onSubmit: SubmitHandler<ClientFormValues> = async (data) => {
    if (!client) return;
    setIsSubmitting(true);
    try {
      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, {
        name: data.name,
      });
      toast({
        title: "Client Updated",
        description: `Client "${data.name}" has been successfully updated.`,
      });
      onClientUpdated();
      onOpenChange(false); // Close dialog on success
    } catch (error) {
      console.error("Error updating client:", error);
      toast({
        title: "Error",
        description: "Could not update client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      reset(); // Ensure form is reset when dialog is closed externally
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update the name for client: {client?.name}.
          </DialogDescription>
        </DialogHeader>
        {client && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="editClientName" className="mb-1 block">Client Name</Label>
              <Input
                id="editClientName"
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

    