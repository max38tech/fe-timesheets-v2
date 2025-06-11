
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, Save, CalendarIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInSeconds, setHours, setMinutes, setSeconds, formatISO, isValid } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDuration } from '@/lib/utils';

interface TimeTrackerProps {
  isJobSelected: boolean;
  technicianId: string | null;
  clientId: string | null;
  locationId: string | null;
}

export function TimeTracker({ isJobSelected, technicianId, clientId, locationId }: TimeTrackerProps) {
  const [entryDate, setEntryDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // State for calendar popover
  const [startTimeValue, setStartTimeValue] = useState<string>(''); // HH:mm format
  const [endTimeValue, setEndTimeValue] = useState<string>('');   // HH:mm format
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setEntryDate(new Date());
    setStartTimeValue('');
    setEndTimeValue('');
    setBreakDurationMinutes('0');
  };

  const handleSaveTimeEntry = async () => {
    if (!isJobSelected || !technicianId || !clientId || !locationId) {
      toast({ title: "Selection Required", description: "Please select a client and location first.", variant: "destructive" });
      return;
    }
    if (!entryDate || !startTimeValue || !endTimeValue) {
      toast({ title: "Input Required", description: "Please fill in date, start time, and end time.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const [startHours, startMinutes] = startTimeValue.split(':').map(Number);
      const [endHours, endMinutes] = endTimeValue.split(':').map(Number);

      let startDateTime = setSeconds(setMinutes(setHours(entryDate, startHours), startMinutes), 0);
      let endDateTime = setSeconds(setMinutes(setHours(entryDate, endHours), endMinutes), 0);
      
      if (!isValid(startDateTime) || !isValid(endDateTime)) {
        toast({ title: "Invalid Time", description: "The start or end time is invalid. Please use HH:mm format.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      if (endDateTime < startDateTime) {
        const potentialTotalDuration = differenceInSeconds(endDateTime, startDateTime) + (24 * 60 * 60);
        if (potentialTotalDuration > 0 && potentialTotalDuration < (24 * 60 * 60 * 1.5) ) { 
            endDateTime.setDate(endDateTime.getDate() + 1);
        } else {
            toast({ title: "Invalid Times", description: "End time must be after start time. For overnight shifts, ensure the duration is reasonable.", variant: "destructive" });
            setIsSaving(false);
            return;
        }
      }


      const totalDurationSeconds = differenceInSeconds(endDateTime, startDateTime);
       if (totalDurationSeconds < 0) {
          toast({ title: "Invalid Times", description: "End time must be after start time.", variant: "destructive" });
          setIsSaving(false);
          return;
      }


      const breakInSeconds = parseInt(breakDurationMinutes, 10) * 60 || 0;
      if (breakInSeconds < 0) {
        toast({ title: "Invalid Break", description: "Break duration cannot be negative.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      if (breakInSeconds > totalDurationSeconds) {
        toast({ title: "Invalid Break", description: "Break duration cannot exceed total work duration.", variant: "destructive" });
        setIsSaving(false);
        return;
      }


      const workDurationSeconds = Math.max(0, totalDurationSeconds - breakInSeconds);

      if (workDurationSeconds > 86400 * 2) { 
        toast({ title: "Duration Too Long", description: "Calculated work duration seems excessively long (over 48 hours). Please check inputs.", variant: "warning" });
      }


      const timeEntriesCollectionRef = collection(db, 'timeEntries');
      await addDoc(timeEntriesCollectionRef, {
        technicianId,
        clientId,
        locationId,
        startTime: formatISO(startDateTime),
        endTime: formatISO(endDateTime),
        totalBreakDurationSeconds: breakInSeconds,
        workDurationSeconds,
        entryDate: format(entryDate, 'yyyy-MM-dd'), 
        createdAt: serverTimestamp(),
      });

      toast({ title: "Time Entry Saved", description: `Work duration: ${formatDuration(workDurationSeconds)}. Entry saved successfully.` });
      resetForm();

    } catch (error: any) {
      console.error("Error saving time entry:", error);
      toast({ title: "Save Error", description: `Could not save time entry: ${error.message || "Please try again."}`, variant: "destructive"});
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Manual Time Entry
        </CardTitle>
        <CardDescription>
          Enter your work date, start time (HH:mm), end time (HH:mm), and any break duration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="entryDate">Work Date</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="entryDate"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !entryDate && "text-muted-foreground"
                )}
                disabled={!isJobSelected || isSaving}
                onClick={() => setIsCalendarOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {entryDate ? format(entryDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={entryDate}
                onSelect={(date) => {
                    setEntryDate(date);
                    setIsCalendarOpen(false);
                }}
                initialFocus
                disabled={(date) => date > new Date() || date < new Date("2000-01-01") || !isJobSelected || isSaving}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Start Time (HH:mm)</Label>
            <Input
              id="startTime"
              type="time"
              value={startTimeValue}
              onChange={(e) => setStartTimeValue(e.target.value)}
              disabled={!isJobSelected || isSaving || !entryDate}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="endTime">End Time (HH:mm)</Label>
            <Input
              id="endTime"
              type="time"
              value={endTimeValue}
              onChange={(e) => setEndTimeValue(e.target.value)}
              disabled={!isJobSelected || isSaving || !entryDate}
              className="mt-1"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
          <Input
            id="breakDuration"
            type="number"
            value={breakDurationMinutes}
            onChange={(e) => setBreakDurationMinutes(e.target.value)}
            placeholder="e.g., 30"
            min="0"
            disabled={!isJobSelected || isSaving || !entryDate}
            className="mt-1"
          />
        </div>

        <Button 
          onClick={handleSaveTimeEntry} 
          disabled={!isJobSelected || isSaving || !startTimeValue || !endTimeValue || !entryDate} 
          className="w-full"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Time Entry"}
        </Button>

        {!isJobSelected && (
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Select a client and location to enable time entry.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

