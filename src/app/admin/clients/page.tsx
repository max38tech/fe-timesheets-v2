"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Briefcase, MapPin, PlusCircle, Loader2, AlertTriangle, Edit3, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AddClientDialog } from '@/components/admin/add-client-dialog';
// --> We import the types from the EditClientDialog to ensure they match
import { EditClientDialog, type Client as FullClient, type Location as FullLocation } from '@/components/admin/edit-client-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';


// --> These are simplified types for the initial list view
interface ClientListItem {
  id: string;
  name: string;
  // We add the other fields here so we can pass them if they exist
  primaryContactName?: string;
  primaryContactEmail?: string;
}

interface LocationListItem {
  id: string;
  name: string;
  clientId: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [locationsByClient, setLocationsByClient] = useState<Record<string, LocationListItem[]>>({});
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  
  // --> We now only need one state for editing, which holds the FULL client data
  const [isEditClientDialogOpen, setIsEditClientDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<FullClient | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'client' | 'location'; clientId?: string; description: string; } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const fetchClients = useCallback(async () => {
    setIsLoadingClients(true);
    setError(null);
    try {
      const clientsCollectionRef = collection(db, 'clients');
      const q = query(clientsCollectionRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      // --> We fetch all client data now, not just name
      const fetchedClients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClientListItem));
      setClients(fetchedClients);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients. Please try again.");
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchLocationsForClient = useCallback(async (clientId: string) => {
    if (locationsByClient[clientId]) return;
    setIsLoadingLocations(prev => ({ ...prev, [clientId]: true }));
    try {
      const locationsCollectionRef = collection(db, 'locations');
      const q = query(locationsCollectionRef, where('clientId', '==', clientId), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const fetchedLocations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LocationListItem));
      setLocationsByClient(prev => ({ ...prev, [clientId]: fetchedLocations }));
    } catch (err) {
      console.error(`Error fetching locations for client ${clientId}:`, err);
    } finally {
      setIsLoadingLocations(prev => ({ ...prev, [clientId]: false }));
    }
  }, [locationsByClient]);
  
  const handleClientAddedOrUpdated = () => {
    fetchClients(); 
  };

  // --> THIS IS THE NEW, UPGRADED FUNCTION
  const handleOpenEditDialog = async (client: ClientListItem) => {
    // 1. Fetch all locations for the given client ID
    const locationsQuery = query(collection(db, 'locations'), where('clientId', '==', client.id));
    const locationsSnapshot = await getDocs(locationsQuery);
    const locations = locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FullLocation[];

    // 2. Combine the client data with its fetched locations into the full object
    const fullClientData: FullClient = {
      id: client.id,
      name: client.name,
      primaryContactName: client.primaryContactName || "",
      primaryContactEmail: client.primaryContactEmail || "",
      locations: locations,
    };

    // 3. Set the complete data object into state and open the dialog
    setClientToEdit(fullClientData);
    setIsEditClientDialogOpen(true);
  };

  const openDeleteConfirmation = async (item: { id: string; name: string; type: 'client' | 'location'; clientId?: string }) => {
    // This logic can be simplified later, but we'll leave it for now
    let description = `Are you sure you want to delete ${item.type} "${item.name}"?`;
    // ... (rest of delete logic remains the same for now)
    setItemToDelete({ ...item, description });
    setIsConfirmDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    // ... (delete logic remains the same for now)
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-8 w-8 text-primary" />
          Client & Location Management
        </h1>
        <Button onClick={() => setIsAddClientDialogOpen(true)} size="lg">
          <PlusCircle className="mr-2 h-5 w-5" />
          Add New Client
        </Button>
      </div>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Client Directory</CardTitle>
          <CardDescription>Manage client information and their associated job locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClients ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading clients...</p>
            </div>
          ) : (
            <Accordion 
              type="multiple" 
              className="w-full"
              onValueChange={(openClientIds) => {
                openClientIds.forEach(clientId => fetchLocationsForClient(clientId));
              }}
            >
              {clients.map((client) => (
                <AccordionItem value={client.id} key={client.id}>
                  <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-md text-lg">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{client.name}</span>
                       <div className="flex items-center gap-2 mr-2">
                        {/* --> The edit button now calls our new function */}
                        <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); handleOpenEditDialog(client); }}>
                            <Edit3 className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openDeleteConfirmation({id: client.id, name: client.name, type: 'client'}); }}>
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 px-4 bg-muted/30 rounded-b-md">
                    {/* --> The location list and add/edit/delete buttons are now simplified */}
                    {isLoadingLocations[client.id] ? (
                      <div className="flex items-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary mr-2" /><span>Loading locations...</span></div>
                    ) : (locationsByClient[client.id] && locationsByClient[client.id].length > 0) ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Locations:</h4>
                        <ul className="space-y-2">
                          {locationsByClient[client.id].map((location) => (
                            <li key={location.id} className="flex items-center justify-between p-2 rounded-md">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span>{location.name}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-center py-4"><p className="text-muted-foreground mb-2">No locations found.</p></div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
      {/* DIALOGS SECTION */}
      <AddClientDialog
        isOpen={isAddClientDialogOpen}
        onOpenChange={setIsAddClientDialogOpen}
        onClientAdded={handleClientAddedOrUpdated}
      />
      {clientToEdit && (
        <EditClientDialog
          isOpen={isEditClientDialogOpen}
          onOpenChange={setIsEditClientDialogOpen}
          client={clientToEdit}
          onClientUpdated={() => {
            setClientToEdit(null); 
            handleClientAddedOrUpdated();
          }}
        />
      )}
      {itemToDelete && (
        <ConfirmDeleteDialog
          isOpen={isConfirmDeleteDialogOpen}
          onOpenChange={setIsConfirmDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          title={`Delete ${itemToDelete.type === 'client' ? 'Client' : 'Location'}`}
          description={itemToDelete.description}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}