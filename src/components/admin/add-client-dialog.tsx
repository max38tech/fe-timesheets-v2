"use client";

import React, { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
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
//--> We need a new hook from react-hook-form
import { useForm, type SubmitHandler, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

//--> 1. Define a schema for a single location
const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
});

//--> 2. Update the main client schema to include primary contacts and an array of locations
const clientSchema = z.object({
  name: z.string().min(2, { message: "Client name must be at least 2 characters." }),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
  locations: z.array(locationSchema).min(1, { message: "At least one location is required." }),
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
    control, // --> 3. We need to get `control` out of useForm
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    //--> 4. Set default values, including one empty location to start
    defaultValues: {
      name: "",
      primaryContactName: "",
      primaryContactEmail: "",
      locations: [{ name: "", contactName: "", contactEmail: "" }],
    },
  });

  //--> 5. Call the useFieldArray hook to manage our dynamic locations
  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });

  const onSubmit: SubmitHandler<ClientFormValues> = async (data) => {
    // We will update this logic in Phase 3
    console.log(data); // For now, we'll just log the data
    return; // And we'll stop the submission temporarily
    
    // The old code below will be replaced later
    setIsSubmitting(true);
    // ...
  };
// end phase 1, top of file paste

  // Reset form when dialog is closed or opened
  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

    return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Add a new client and all of their office or work locations at once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* We wrap the content in a ScrollArea for when there are many locations */}
          <ScrollArea className="h-[60vh] p-4 border rounded-md">
            <div className="space-y-4">
              {/* === SECTION 1: PRIMARY CLIENT DETAILS === */}
              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  {...register("name")}
                  placeholder="e.g., Acme Corporation"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="primaryContactName">Primary Contact Name (Optional)</Label>
                <Input
                  id="primaryContactName"
                  {...register("primaryContactName")}
                  placeholder="e.g., John Doe"
                />
              </div>

              <div>
                <Label htmlFor="primaryContactEmail">Primary Contact Email (Optional)</Label>
                <Input
                  id="primaryContactEmail"
                  type="email"
                  {...register("primaryContactEmail")}
                  placeholder="e.g., john.doe@acme.com"
                  className={errors.primaryContactEmail ? "border-destructive" : ""}
                />
                {errors.primaryContactEmail && <p className="text-sm text-destructive mt-1">{errors.primaryContactEmail.message}</p>}
              </div>

              <hr className="my-6" />

              {/* === SECTION 2: DYNAMIC LOCATIONS === */}
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-md relative space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">Location {index + 1}</h4>
                    {/* Show remove button only if there's more than one location */}
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`locations.${index}.name`}>Location Name</Label>
                    <Input
                      id={`locations.${index}.name`}
                      {...register(`locations.${index}.name`)}
                      placeholder="e.g., Downtown Office"
                      className={errors.locations?.[index]?.name ? "border-destructive" : ""}
                    />
                    {errors.locations?.[index]?.name && <p className="text-sm text-destructive mt-1">{errors.locations?.[index]?.name?.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor={`locations.${index}.contactName`}>Location Contact Name (Optional)</Label>
                    <Input
                      id={`locations.${index}.contactName`}
                      {...register(`locations.${index}.contactName`)}
                      placeholder="e.g., Jane Smith"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`locations.${index}.contactEmail`}>Location Contact Email (Optional)</Label>
                    <Input
                      id={`locations.${index}.contactEmail`}
                      type="email"
                      {...register(`locations.${index}.contactEmail`)}
                      placeholder="e.g., jane.smith@acme.com"
                      className={errors.locations?.[index]?.contactEmail ? "border-destructive" : ""}
                    />
                    {errors.locations?.[index]?.contactEmail && <p className="text-sm text-destructive mt-1">{errors.locations?.[index]?.contactEmail?.message}</p>}
                  </div>
                </div>
              ))}

              {/* === SECTION 3: "ADD LOCATION" BUTTON === */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => append({ name: "", contactName: "", contactEmail: "" })}
              >
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
              {isSubmitting ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    