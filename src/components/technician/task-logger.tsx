
"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface TaskLoggerProps {
  isJobSelected: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function TaskLogger({ isJobSelected, notes, onNotesChange }: TaskLoggerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Task Logger
        </CardTitle>
        <CardDescription>Add notes and comments for the current job session. Notes are saved automatically as you type.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Describe tasks performed, issues encountered, or any relevant details..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={5}
          disabled={!isJobSelected}
          aria-label="Task notes"
        />
        {/* Removed Save Notes button as notes are now handled by the parent through onNotesChange */}
      </CardContent>
    </Card>
  );
}
