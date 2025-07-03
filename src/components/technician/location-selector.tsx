
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'; // Firestore imports

interface Location {
  id: string;
  name: string;
}

interface LocationSelectorProps {
  selectedClientId: string | null;
  selectedLocation: Location | null;
  onLocationSelect: (location: Location | null) => void;
}

export function LocationSelector({ selectedClientId, selectedLocation, onLocationSelect }: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!selectedClientId) {
        setAvailableLocations([]);
        setFilteredLocations([]);
        setIsLoading(false);
        setError(null);
        // If a location was selected for a previous client, deselect it.
        if (selectedLocation) onLocationSelect(null); 
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const locationsCollectionRef = collection(db, 'locations');
        const q = query(
          locationsCollectionRef, 
          where('clientId', '==', selectedClientId), 
          orderBy('name')
        );
        const querySnapshot = await getDocs(q);
        const locationsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
        }));
        setAvailableLocations(locationsData);
        setFilteredLocations(locationsData);

        // If current selectedLocation doesn't belong to the new client, deselect it
        if (selectedLocation && !locationsData.find(l => l.id === selectedLocation.id)) {
            onLocationSelect(null);
        }

      } catch (err) {
        console.error("Error fetching locations:", err);
        setError("Failed to load locations. Please try again.");
        setAvailableLocations([]); // Clear on error
        setFilteredLocations([]); // Clear on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]); // onLocationSelect removed to prevent re-fetch loops if parent re-renders it

  useEffect(() => {
    if (searchTerm.length >= 1) {
      setFilteredLocations(
        availableLocations.filter(location =>
          location.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredLocations(availableLocations);
    }
  }, [searchTerm, availableLocations]);

  const handleSelectLocation = (location: Location) => {
    onLocationSelect(location);
    setSearchTerm('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={inputRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={!selectedClientId || isLoading}
          aria-label="Select location"
        >
          {isLoading && selectedClientId ? "Loading locations..." :
           selectedLocation ? selectedLocation.name : 
           (selectedClientId ? "Select location..." : "Select client first")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0" 
        style={{ width: inputRef.current ? `${inputRef.current.offsetWidth}px` : 'auto' }}
        align="start"
      >
        <Card>
          <CardContent className="p-2">
            <Input
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
              aria-label="Search locations input"
              disabled={!selectedClientId || isLoading || (!isLoading && !error && availableLocations.length === 0)}
            />
            <div className="max-h-60 overflow-auto">
              {isLoading ? (
                 <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading locations...</span>
                </div>
              ) : error ? (
                <p className="p-2 text-sm text-destructive">{error}</p>
              ) : filteredLocations.length > 0 ? (
                filteredLocations.map((location) => (
                  <Button
                    key={location.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start mb-1 text-left h-auto py-2", // Ensure text wraps
                      selectedLocation?.id === location.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelectLocation(location)}
                  >
                     <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedLocation?.id === location.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 break-words">{location.name}</span>
                  </Button>
                ))
              ) : (
                <p className="p-2 text-sm text-muted-foreground">
                  {selectedClientId && availableLocations.length === 0 && !error ? "No locations for this client." : 
                   selectedClientId && !error ? "No locations match your search." :
                   !selectedClientId ? "Select a client to see locations." : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
