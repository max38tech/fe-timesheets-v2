
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, getDocs, query, orderBy } from 'firebase/firestore'; // Firestore imports

interface Client {
  id: string;
  name: string;
}

interface ClientSelectorProps {
  selectedClient: Client | null;
  onClientSelect: (client: Client | null) => void;
}

export function ClientSelector({ selectedClient, onClientSelect }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const clientsCollectionRef = collection(db, 'clients');
        const q = query(clientsCollectionRef, orderBy('name'));
        const querySnapshot = await getDocs(q);
        const clientsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
        }));
        setAllClients(clientsData);
        setFilteredClients(clientsData); // Initialize filtered clients with all clients
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError("Failed to load clients. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 1) {
      setFilteredClients(
        allClients.filter(client =>
          client.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredClients(allClients);
    }
  }, [searchTerm, allClients]);

  const handleSelectClient = (client: Client) => {
    onClientSelect(client);
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
          aria-label="Select client"
        >
          {selectedClient ? selectedClient.name : "Select client..."}
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
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
              aria-label="Search clients input"
            />
            <div className="max-h-60 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading clients...</span>
                </div>
              ) : error ? (
                <p className="p-2 text-sm text-destructive">{error}</p>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <Button
                    key={client.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start mb-1 text-left h-auto py-2", // Ensure text wraps if needed
                      selectedClient?.id === client.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelectClient(client)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0", // Ensure Check icon is shrinkable
                        selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 break-words">{client.name}</span>
                  </Button>
                ))
              ) : (
                <p className="p-2 text-sm text-muted-foreground">No clients found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
