
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, parseISO, setHours, setMinutes, setSeconds, differenceInSeconds, formatISO, isValid } from 'date-fns';
import { cn, formatDuration } from '@/lib/utils';
// Define EnrichedTimeEntry interface locally since we can't import it
interface EnrichedTimeEntry {
  id: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  workDurationSeconds: number;
  totalBreakDurationSeconds: number;
  clientId: string;
  locationId: string;
  technicianId: string;
  clientName: string;
  locationName: string;
  technicianNameOrEmail: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  workDurationFormatted: string;
  breakDurationFormatted: string;
}
import { ClientSelector } from '@/components/technician/client-selector'; // For selecting clients
import { LocationSelector } from '@/components/technician/location-selector'; // For selecting locations

const timeEntrySchema = z.object({
  entryDate: z.date({ required_error: "Entry date is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid start time format (HH:mm)." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid end time format (HH:mm)." }),
  breakDurationMinutes: z.number().min(0, { message: "Break duration cannot be negative." }),
  clientId: z.string().min(1, { message: "Client is required."}),
  locationId: z.string().min(1, { message: "Location is required."}),
  taskNotes: z.string().optional(),
});

type TimeEntryFormValues = z.infer<typeof timeEntrySchema>;

interface Client {
  id: string;
  name: string;
}
interface Location {
  id: string;
  name: string;
}

interface EditTimeEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: EnrichedTimeEntry | null;
  onTimeEntryUpdated: () => void;
}

export function EditTimeEntryDialog({ 
  isOpen, 
  onOpenChange, 
  timeEntry: initialTimeEntry, 
  onTimeEntryUpdated 
}: EditTimeEntryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // State for calendar popover
  const { toast } = useToast();

  // State for client/location selectors within the dialog
  const [dialogSelectedClient, setDialogSelectedClient] = useState<Client | null>(null);
  const [dialogSelectedLocation, setDialogSelectedLocation] = useState<Location | null>(null);
  
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    watch,
  } = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      entryDate: new Date(),
      startTime: "09:00",
      endTime: "17:00",
      breakDurationMinutes: 0,
      clientId: "",
      locationId: "",
      taskNotes: "",
    }
  });

  // Effect to set initial form values when dialog opens or timeEntry changes
  useEffect(() => {
    if (initialTimeEntry && isOpen) {
      setValue("entryDate", parseISO(initialTimeEntry.entryDate));
      setValue("startTime", initialTimeEntry.startTime ? format(parseISO(initialTimeEntry.startTime), 'HH:mm') : "00:00");
      setValue("endTime", initialTimeEntry.endTime ? format(parseISO(initialTimeEntry.endTime), 'HH:mm') : "00:00");
      setValue("breakDurationMinutes", Math.round(initialTimeEntry.totalBreakDurationSeconds / 60));
      setValue("clientId", initialTimeEntry.clientId);
      setValue("locationId", initialTimeEntry.locationId);

      // Set state for our custom ClientSelector/LocationSelector
      setDialogSelectedClient({ id: initialTimeEntry.clientId, name: initialTimeEntry.clientName });
      setDialogSelectedLocation({ id: initialTimeEntry.locationId, name: initialTimeEntry.locationName });

    } else if (!isOpen) {
      reset(); 
      setDialogSelectedClient(null);
      setDialogSelectedLocation(null);
    }
  }, [initialTimeEntry, isOpen, setValue, reset]);

  // Update RHF clientId when dialogSelectedClient changes
  useEffect(() => {
    if (dialogSelectedClient) {
      setValue("clientId", dialogSelectedClient.id, { shouldValidate: true });
    } else {
      setValue("clientId", "", { shouldValidate: true });
    }
  }, [dialogSelectedClient, setValue]);

  // Update RHF locationId when dialogSelectedLocation changes
  useEffect(() => {
    if (dialogSelectedLocation) {
      setValue("locationId", dialogSelectedLocation.id, { shouldValidate: true });
    } else {
      setValue("locationId", "", { shouldValidate: true });
    }
  }, [dialogSelectedLocation, setValue]);


  const onSubmit: SubmitHandler<TimeEntryFormValues> = async (data) => {
    if (!initialTimeEntry) return;
    setIsSubmitting(true);

    try {
      const [startHours, startMinutes] = data.startTime.split(':').map(Number);
      const [endHours, endMinutes] = data.endTime.split(':').map(Number);

      let startDateTime = setSeconds(setMinutes(setHours(data.entryDate, startHours), startMinutes), 0);
      let endDateTime = setSeconds(setMinutes(setHours(data.entryDate, endHours), endMinutes), 0);

      if (!isValid(startDateTime) || !isValid(endDateTime)) {
        toast({ title: "Invalid Time", description: "The start or end time resulted in an invalid date. Please check inputs.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      if (endDateTime < startDateTime) {
         const potentialTotalDuration = differenceInSeconds(endDateTime, startDateTime) + (24 * 60 * 60);
        if (potentialTotalDuration > 0 && potentialTotalDuration < (24 * 60 * 60 * 1.5) ) {
            endDateTime.setDate(endDateTime.getDate() + 1);
        } else {
            toast({ title: "Invalid Times", description: "End time must be after start time. For overnight shifts, ensure duration is reasonable.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
      }
      
      const totalDurationSeconds = differenceInSeconds(endDateTime, startDateTime);
      if (totalDurationSeconds < 0) {
          toast({ title: "Invalid Times", description: "End time must be after start time.", variant: "destructive" });
          setIsSubmitting(false);
          return;
      }

      const breakInSeconds = data.breakDurationMinutes * 60;
      if (breakInSeconds > totalDurationSeconds) {
        toast({ title: "Invalid Break", description: "Break duration cannot exceed total work duration.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const workDurationSeconds = Math.max(0, totalDurationSeconds - breakInSeconds);

      const timeEntryRef = doc(db, 'timeEntries', initialTimeEntry.id);
      await updateDoc(timeEntryRef, {
        entryDate: format(data.entryDate, 'yyyy-MM-dd'),
        startTime: formatISO(startDateTime),
        endTime: formatISO(endDateTime),
        totalBreakDurationSeconds: breakInSeconds,
        workDurationSeconds: workDurationSeconds,
        clientId: data.clientId,
        locationId: data.locationId,
        taskNotes: data.taskNotes || null // Save task notes, use null if undefined
      });

      toast({
        title: "Time Entry Updated",
        description: "The time entry has been successfully updated.",
      });
      onTimeEntryUpdated();
      onOpenChange(false); 
    } catch (error: any) {
      console.error("Error updating time entry:", error);
      toast({
        title: "Error",
        description: `Could not update time entry. ${error.message || "Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDialogClose = (openState: boolean) => {
    if (!openState) {
      reset(); 
      setDialogSelectedClient(null);
      setDialogSelectedLocation(null);
    }
    onOpenChange(openState);
  };

  const watchedEntryDate = watch("entryDate");
  const watchedStartTime = watch("startTime");
  const watchedEndTime = watch("endTime");
  const watchedBreakMinutes = watch("breakDurationMinutes");
  
  const calculateDisplayDuration = () => {
    try {
      if (!watchedEntryDate || !watchedStartTime || !watchedEndTime || !isValid(watchedEntryDate)) return "N/A";
      const [startH, startM] = watchedStartTime.split(':').map(Number);
      const [endH, endM] = watchedEndTime.split(':').map(Number);

      let sDate = setSeconds(setMinutes(setHours(new Date(watchedEntryDate), startH), startM),0);
      let eDate = setSeconds(setMinutes(setHours(new Date(watchedEntryDate), endH), endM),0);
      
      if (!isValid(sDate) || !isValid(eDate)) return "Invalid time";

      if (eDate < sDate) eDate.setDate(eDate.getDate() + 1); 

      const totalSec = differenceInSeconds(eDate, sDate);
      if (totalSec < 0) return "End < Start";
      
      const breakSec = (parseInt(String(watchedBreakMinutes), 10) || 0) * 60;
      if (breakSec > totalSec) return "Break > Total";

      return formatDuration(Math.max(0, totalSec - breakSec));
    } catch {
      return "Error";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
          <DialogDescription>
            Modify the details for this time entry.
          </DialogDescription>
           {initialTimeEntry && (
            <p className="text-xs text-muted-foreground pt-1">
              Technician: {initialTimeEntry.technicianNameOrEmail}
            </p>
          )}
        </DialogHeader>
        {initialTimeEntry && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="editClientId">Client</Label>
              <ClientSelector
                selectedClient={dialogSelectedClient}
                onClientSelect={(client) => {
                  setDialogSelectedClient(client);
                  setDialogSelectedLocation(null); 
                  setValue("locationId", "", { shouldValidate: true }); 
                }}
              />
              {errors.clientId && <p className="text-sm text-destructive mt-1">{errors.clientId.message}</p>}
            </div>

            <div>
              <Label htmlFor="editLocationId">Location</Label>
              <LocationSelector
                selectedClientId={dialogSelectedClient?.id || null}
                selectedLocation={dialogSelectedLocation}
                onLocationSelect={setDialogSelectedLocation}
              />
              {errors.locationId && <p className="text-sm text-destructive mt-1">{errors.locationId.message}</p>}
            </div>
            
            <div>
              <Label htmlFor="editEntryDate">Work Date</Label>
              <Controller
                name="entryDate"
                control={control}
                render={({ field }) => (
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="editEntryDate"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !field.value && "text-muted-foreground",
                          errors.entryDate && "border-destructive"
                        )}
                        disabled={isSubmitting}
                        onClick={() => setIsCalendarOpen(true)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            field.onChange(date);
                            setIsCalendarOpen(false);
                        }}
                        initialFocus
                        disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.entryDate && <p className="text-sm text-destructive mt-1">{errors.entryDate.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editStartTime">Start Time (HH:mm)</Label>
                <Input
                  id="editStartTime"
                  type="time"
                  {...register("startTime")}
                  disabled={isSubmitting}
                  className={cn("mt-1", errors.startTime && "border-destructive")}
                />
                {errors.startTime && <p className="text-sm text-destructive mt-1">{errors.startTime.message}</p>}
              </div>
              <div>
                <Label htmlFor="editEndTime">End Time (HH:mm)</Label>
                <Input
                  id="editEndTime"
                  type="time"
                  {...register("endTime")}
                  disabled={isSubmitting}
                  className={cn("mt-1", errors.endTime && "border-destructive")}
                />
                {errors.endTime && <p className="text-sm text-destructive mt-1">{errors.endTime.message}</p>}
              </div>
            </div>
            
            <div>
              <Label htmlFor="editBreakDuration">Break Duration (minutes)</Label>
              <Input
                id="editBreakDuration"
                type="number"
                {...register("breakDurationMinutes")}
                placeholder="e.g., 30"
                min="0"
                disabled={isSubmitting}
                className={cn("mt-1", errors.breakDurationMinutes && "border-destructive")}
              />
              {errors.breakDurationMinutes && <p className="text-sm text-destructive mt-1">{errors.breakDurationMinutes.message}</p>}
            </div>

            <div>
              <Label htmlFor="editTaskNotes">Task Notes</Label>
              <Textarea
                id="editTaskNotes"
                {...register("taskNotes")}
                placeholder="Enter task notes..."
                disabled={isSubmitting}
                className={cn("mt-1", errors.taskNotes && "border-destructive")}
                rows={3}
              />
              {errors.taskNotes && <p className="text-sm text-destructive mt-1">{errors.taskNotes.message}</p>}
            </div>

            <div className="text-sm text-muted-foreground">
              Calculated Work Duration: <span className="font-medium text-foreground">{calculateDisplayDuration()}</span>
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

