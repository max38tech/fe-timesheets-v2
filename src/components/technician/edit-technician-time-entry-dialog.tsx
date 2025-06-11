
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, parseISO, setHours, setMinutes, setSeconds, differenceInSeconds, formatISO, isValid } from 'date-fns';
import { cn, formatDuration } from '@/lib/utils';
import type { TimeEntry as EnrichedTimeEntryData } from '@/components/technician/todays-time-entries'; // Use the specific type from there

// Simplified TimeEntry for this dialog as client/location are context
interface TimeEntryForDialog {
  id: string;
  entryDate: Date; // Date object
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  totalBreakDurationSeconds: number;
  workDurationSeconds: number;
  // Contextual, non-editable:
  clientName: string;
  locationName: string;
  technicianId: string;
}

const timeEntryEditSchema = z.object({
  entryDate: z.date({ required_error: "Entry date is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid start time format (HH:mm)." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid end time format (HH:mm)." }),
  breakDurationMinutes: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : 0),
    z.number().min(0, { message: "Break duration cannot be negative." })
  ),
});

type TimeEntryEditFormValues = z.infer<typeof timeEntryEditSchema>;

interface EditTechnicianTimeEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: EnrichedTimeEntryData & { clientName?: string; locationName?: string; technicianId?: string } | null;
  onTimeEntryUpdated: () => void;
}

export function EditTechnicianTimeEntryDialog({
  isOpen,
  onOpenChange,
  timeEntry: initialTimeEntry,
  onTimeEntryUpdated
}: EditTechnicianTimeEntryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { toast } = useToast();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    watch,
  } = useForm<TimeEntryEditFormValues>({
    resolver: zodResolver(timeEntryEditSchema),
    defaultValues: {
      entryDate: new Date(),
      startTime: "09:00",
      endTime: "17:00",
      breakDurationMinutes: 0,
    }
  });

  useEffect(() => {
    if (initialTimeEntry && isOpen) {
      // The initialTimeEntry from TodaysTimeEntries uses ISO strings for startTime/endTime
      // and entryDate is likely already a Date object if handled by a date picker,
      // but we should parseISO for entryDate if it's a string (YYYY-MM-DD from Firestore initially)
      // For this dialog, it's simpler if TodaysTimeEntries passes the date as a string YYYY-MM-DD
      // Let's assume initialTimeEntry has startTime/endTime as ISO strings
      
      let parsedEntryDate = new Date(); // default
      // Try to parse entryDate, which might come from a different source than a Date object.
      // TodaysTimeEntries uses displayDate (Date object) for querying, but timeEntry passed might have a string date.
      // For simplicity, we'll assume the parent TodaysTimeEntries will pass a timeEntry that includes `originalEntryDateISOString`
      // or it directly passes startTime and endTime as ISO strings, and entryDate will be derived for display from startTime
      if (initialTimeEntry.startTime && isValid(parseISO(initialTimeEntry.startTime))) {
        parsedEntryDate = parseISO(initialTimeEntry.startTime);
      }
      
      setValue("entryDate", parsedEntryDate);
      setValue("startTime", initialTimeEntry.startTime ? format(parseISO(initialTimeEntry.startTime), 'HH:mm') : "00:00");
      setValue("endTime", initialTimeEntry.endTime ? format(parseISO(initialTimeEntry.endTime), 'HH:mm') : "00:00");
      setValue("breakDurationMinutes", Math.round(initialTimeEntry.totalBreakDurationSeconds / 60));
    } else if (!isOpen) {
      reset();
    }
  }, [initialTimeEntry, isOpen, setValue, reset]);

  const onSubmit: SubmitHandler<TimeEntryEditFormValues> = async (data) => {
    if (!initialTimeEntry || !initialTimeEntry.technicianId || !initialTimeEntry.clientId || !initialTimeEntry.locationId) {
        toast({ title: "Error", description: "Missing essential time entry information.", variant: "destructive"});
        return;
    }
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
        // technicianId, clientId, locationId remain unchanged as they define the context
        entryDate: format(data.entryDate, 'yyyy-MM-dd'), // Save date as YYYY-MM-DD string
        startTime: formatISO(startDateTime),
        endTime: formatISO(endDateTime),
        totalBreakDurationSeconds: breakInSeconds,
        workDurationSeconds: workDurationSeconds,
      });

      toast({
        title: "Time Entry Updated",
        description: "Your time entry has been successfully updated.",
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
            Modify your time entry details. Client and Location are fixed for this entry.
          </DialogDescription>
           {initialTimeEntry && (
            <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
                <p>Client: <span className="font-medium">{initialTimeEntry.clientName || "N/A"}</span></p>
                <p>Location: <span className="font-medium">{initialTimeEntry.locationName || "N/A"}</span></p>
            </div>
          )}
        </DialogHeader>
        {initialTimeEntry && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="techEditEntryDate">Work Date</Label>
              <Controller
                name="entryDate"
                control={control}
                render={({ field }) => (
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="techEditEntryDate"
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
                <Label htmlFor="techEditStartTime">Start Time (HH:mm)</Label>
                <Input
                  id="techEditStartTime"
                  type="time"
                  {...register("startTime")}
                  disabled={isSubmitting}
                  className={cn("mt-1", errors.startTime && "border-destructive")}
                />
                {errors.startTime && <p className="text-sm text-destructive mt-1">{errors.startTime.message}</p>}
              </div>
              <div>
                <Label htmlFor="techEditEndTime">End Time (HH:mm)</Label>
                <Input
                  id="techEditEndTime"
                  type="time"
                  {...register("endTime")}
                  disabled={isSubmitting}
                  className={cn("mt-1", errors.endTime && "border-destructive")}
                />
                {errors.endTime && <p className="text-sm text-destructive mt-1">{errors.endTime.message}</p>}
              </div>
            </div>
            
            <div>
              <Label htmlFor="techEditBreakDuration">Break Duration (minutes)</Label>
              <Input
                id="techEditBreakDuration"
                type="number"
                {...register("breakDurationMinutes")}
                placeholder="e.g., 30"
                min="0"
                disabled={isSubmitting}
                className={cn("mt-1", errors.breakDurationMinutes && "border-destructive")}
              />
              {errors.breakDurationMinutes && <p className="text-sm text-destructive mt-1">{errors.breakDurationMinutes.message}</p>}
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

