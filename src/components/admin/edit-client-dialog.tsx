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
import { useForm, type SubmitHandler, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection } from 'firebase/firestore'; // Updated imports
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- We are using the same, more detailed schema from the "add" dialog ---
const locationSchema = z.object({
  id: z.string().optional(), // Locations will have an ID when they already exist
  name: z.string().min(1, "Location name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
});

const clientSchema = z.object({
  name: z.string().min(2, { message: "Client name must be at least 2 characters." }),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
  locations: z.array(locationSchema).min(1, { message: "At least one location is required." }),
});

type ClientFormValues = z.infer<typeof clientSchema>;

// --- We define a richer Client type that includes locations ---
export interface Location {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  clientId: string;
}

export interface Client {
  id: string;
  name: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  locations: Location[]; // The client object now holds its locations
}

interface EditClientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null; // The component now expects the richer Client object
  onClientUpdated: () => void;
}

export function EditClientDialog({ isOpen, onOpenChange, client, onClientUpdated }: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });

  // This useEffect now resets the entire form with the client AND location data
  useEffect(() => {
    if (client && isOpen) {
      reset(client);
    } else {
      reset({
        name: "",
        primaryContactName: "",
        primaryContactEmail: "",
        locations: [],
      });
    }
  }, [client, isOpen, reset]);
  
  const onSubmit: SubmitHandler<ClientFormValues> = async (data) => {
    if (!client) {
      toast({
        title: "Error",
        description: "No client selected to update.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const clientDocRef = doc(db, 'clients', client.id);

      // Update client document
      batch.update(clientDocRef, {
        name: data.name,
        primaryContactName: data.primaryContactName || null,
        primaryContactEmail: data.primaryContactEmail || null,
      });

      // Handle locations updates
      const existingLocationIds = client.locations.map(loc => loc.id);
      const submittedLocationIds = data.locations.map(loc => loc.id).filter(id => id !== undefined) as string[];

      // Locations to remove (existing but not submitted)
      const locationsToRemove = existingLocationIds.filter(id => !submittedLocationIds.includes(id));

      // Remove deleted locations
      locationsToRemove.forEach(locationId => {
        const locationDocRef = doc(db, 'locations', locationId);
        batch.delete(locationDocRef);
      });

      // Add or update locations
      for (const loc of data.locations) {
        if (loc.id) {
          // Update existing location
          const locationDocRef = doc(db, 'locations', loc.id);
          batch.update(locationDocRef, {
            name: loc.name,
            contactName: loc.contactName || null,
            contactEmail: loc.contactEmail || null,
          });
        } else {
          // Add new location
          const locationsCollectionRef = collection(db, 'locations');
          const newLocationRef = doc(locationsCollectionRef);
          batch.set(newLocationRef, {
            name: loc.name,
            contactName: loc.contactName || null,
            contactEmail: loc.contactEmail || null,
            clientId: client.id,
          });
        }
      }

      await batch.commit();

      toast({
        title: "Client Updated",
        description: `Client "${data.name}" and locations have been successfully updated.`,
      });
      onClientUpdated();
      onOpenChange(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* --- The JSX is now almost identical to the AddClientDialog --- */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update the details for {client?.name} and manage their locations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <ScrollArea className="h-[60vh] p-4 border rounded-md">
            <div className="space-y-4">
              {/* Client Details */}
              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="primaryContactName">Primary Contact Name (Optional)</Label>
                <Input id="primaryContactName" {...register("primaryContactName")} />
              </div>
              <div>
                <Label htmlFor="primaryContactEmail">Primary Contact Email (Optional)</Label>
                <Input id="primaryContactEmail" type="email" {...register("primaryContactEmail")} />
                {errors.primaryContactEmail && <p className="text-sm text-destructive mt-1">{errors.primaryContactEmail.message}</p>}
              </div>
              <hr className="my-6" />

              {/* Dynamic Locations */}
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-md relative space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">Location {index + 1}</h4>
                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor={`locations.${index}.name`}>Location Name</Label>
                    <Input id={`locations.${index}.name`} {...register(`locations.${index}.name`)} />
                    {errors.locations?.[index]?.name && <p className="text-sm text-destructive mt-1">{errors.locations?.[index]?.name?.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`locations.${index}.contactName`}>Location Contact Name (Optional)</Label>
                    <Input id={`locations.${index}.contactName`} {...register(`locations.${index}.contactName`)} />
                  </div>
                  <div>
                    <Label htmlFor={`locations.${index}.contactEmail`}>Location Contact Email (Optional)</Label>
                    <Input id={`locations.${index}.contactEmail`} type="email" {...register(`locations.${index}.contactEmail`)} />
                    {errors.locations?.[index]?.contactEmail && <p className="text-sm text-destructive mt-1">{errors.locations?.[index]?.contactEmail?.message}</p>}
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" className="w-full" onClick={() => append({ name: "", contactName: "", contactEmail: "" })}>
                Add Another Location
              </Button>
            </div>
          </ScrollArea>

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
      </DialogContent>
    </Dialog>
  );
}