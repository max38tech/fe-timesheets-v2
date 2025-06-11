
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestTaskPrompts, type SuggestTaskPromptsInput } from '@/ai/flows/suggest-task-prompts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SuggestedTasksProps {
  client: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  onTaskSelect: (taskText: string) => void;
}

export function SuggestedTasks({ client, location, onTaskSelect }: SuggestedTasksProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSuggestions = async () => {
    if (!client || !location) {
      // Clear suggestions if client/location not selected
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const input: SuggestTaskPromptsInput = {
        client: client.name,
        location: location.name,
      };
      const result = await suggestTaskPrompts(input);
      setSuggestions(result.suggestedTasks || []);
      if (!result.suggestedTasks || result.suggestedTasks.length === 0) {
        toast({ title: "AI Suggestions", description: "No specific task suggestions found for this combination." });
      }
    } catch (error) {
      console.error("Error fetching task suggestions:", error);
      toast({
        title: "Error",
        description: "Could not fetch task suggestions from AI.",
        variant: "destructive",
      });
      setSuggestions([]); // Clear suggestions on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Automatically fetch when client or location changes
    if (client && location) {
      fetchSuggestions();
    } else {
      setSuggestions([]); // Clear if client/location becomes null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, location]); // Dependency array ensures fetch on change

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            AI Suggested Tasks
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchSuggestions} 
            disabled={isLoading || !client || !location}
            aria-label="Refresh suggestions"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Common tasks based on the selected client and location, powered by AI. Click a task to add it to your notes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : suggestions.length > 0 ? (
          <ul className="space-y-2">
            {suggestions.map((task, index) => (
              <li key={index} className="flex items-center">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-sm py-1 px-2.5",
                    client && location && "cursor-pointer hover:bg-primary/20" // Add interactive styles only if selectable
                  )}
                  onClick={() => {
                    if (client && location) { // Only allow click if client/location selected (which enables suggestions)
                      onTaskSelect(task);
                    }
                  }}
                  role={client && location ? "button" : undefined}
                  tabIndex={client && location ? 0 : undefined}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && client && location) {
                      onTaskSelect(task);
                    }
                  }}
                >
                  {task}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {client && location ? "No suggestions available. Try refreshing." : "Select a client and location to see suggestions."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

    