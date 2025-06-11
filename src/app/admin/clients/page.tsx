
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Briefcase, MapPin, PlusCircle, Loader2, AlertTriangle, Edit3, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, writeBatch, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AddClientDialog } from '@/components/admin/add-client-dialog';
import { AddLocationDialog } from '@/components/admin/add-location-dialog';
import { EditClientDialog } from '@/components/admin/edit-client-dialog';
import { EditLocationDialog } from '@/components/admin/edit-location-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';


interface Client {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  clientId: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [locationsByClient, setLocationsByClient] = useState<Record<string, Location[]>>({});
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [isAddLocationDialogOpen, setIsAddLocationDialogOpen] = useState(false);
  const [currentClientForLocationAdd, setCurrentClientForLocationAdd] = useState<Client | null>(null);

  const [isEditClientDialogOpen, setIsEditClientDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [isEditLocationDialogOpen, setIsEditLocationDialogOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<Location | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'client' | 'location'; clientId?: string; description: string; } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [locationsPendingDeletion, setLocationsPendingDeletion] = useState<Location[]>([]);


  const fetchClients = useCallback(async () => {
    setIsLoadingClients(true);
    setError(null);
    try {
      const clientsCollectionRef = collection(db, 'clients');
      const q = query(clientsCollectionRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const fetchedClients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
      }));
      setClients(fetchedClients);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients. Please try again.");
      toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
    } finally {
      setIsLoadingClients(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchLocationsForClient = useCallback(async (clientId: string, forceRefresh = false) => {
    if (locationsByClient[clientId] && !forceRefresh) {
      return;
    }
    setIsLoadingLocations(prev => ({ ...prev, [clientId]: true }));
    try {
      const locationsCollectionRef = collection(db, 'locations');
      const q = query(locationsCollectionRef, where('clientId', '==', clientId), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const fetchedLocations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
        clientId: doc.data().clientId as string,
      }));
      setLocationsByClient(prev => ({ ...prev, [clientId]: fetchedLocations }));
    } catch (err) {
      console.error(`Error fetching locations for client ${clientId}:`, err);
      toast({ title: "Error", description: `Could not fetch locations for client.`, variant: "destructive" });
    } finally {
      setIsLoadingLocations(prev => ({ ...prev, [clientId]: false }));
    }
  }, [locationsByClient, toast]);
  
  const handleClientAddedOrUpdated = () => {
    fetchClients(); 
  };

  const handleLocationAddedOrUpdated = (clientId: string) => {
    fetchLocationsForClient(clientId, true);
  };

  const handleOpenAddLocationDialog = (client: Client) => {
    setCurrentClientForLocationAdd(client);
    setIsAddLocationDialogOpen(true);
  };

  const handleOpenEditClientDialog = (client: Client) => {
    setClientToEdit(client);
    setIsEditClientDialogOpen(true);
  };

  const handleOpenEditLocationDialog = (location: Location) => {
    setLocationToEdit(location);
    setIsEditLocationDialogOpen(true);
  };

  const openDeleteConfirmation = async (item: { id: string; name: string; type: 'client' | 'location'; clientId?: string }) => {
    let description = `Are you sure you want to delete ${item.type} "${item.name}"? This action cannot be undone.`;
    let tempLocationsPendingDeletion: Location[] = [];

    if (item.type === 'client') {
      setIsLoadingClients(true); // Show loading while fetching associated locations
      try {
        const locationsQuery = query(collection(db, 'locations'), where('clientId', '==', item.id));
        const querySnapshot = await getDocs(locationsQuery);
        tempLocationsPendingDeletion = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
        setLocationsPendingDeletion(tempLocationsPendingDeletion);

        if (tempLocationsPendingDeletion.length > 0) {
          description = `Are you sure you want to delete client "${item.name}"? This will also delete ${tempLocationsPendingDeletion.length} associated location(s). This action cannot be undone.`;
        } else {
          description = `Are you sure you want to delete client "${item.name}"? No associated locations found. This action cannot be undone.`;
        }
      } catch (fetchError) {
        console.error("Error fetching associated locations:", fetchError);
        toast({ title: "Error", description: "Could not check for associated locations. Deletion aborted.", variant: "destructive"});
        setIsLoadingClients(false);
        return;
      } finally {
        setIsLoadingClients(false);
      }
    } else if (item.type === 'location') {
       description = `Are you sure you want to delete location "${item.name}"? This action cannot be undone.`;
       setLocationsPendingDeletion([]); // Clear if it's a location delete
    }
    
    setItemToDelete({ ...item, description });
    setIsConfirmDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'client') {
        const batch = writeBatch(db);

        // Delete associated locations
        locationsPendingDeletion.forEach(loc => {
          batch.delete(doc(db, 'locations', loc.id));
        });
        
        // Delete the client
        batch.delete(doc(db, 'clients', itemToDelete.id));
        
        await batch.commit();

        let toastMessage = `Client "${itemToDelete.name}" has been deleted.`;
        if (locationsPendingDeletion.length > 0) {
          toastMessage = `Client "${itemToDelete.name}" and its ${locationsPendingDeletion.length} associated location(s) have been deleted.`;
        }
        toast({ title: "Client Deleted", description: toastMessage });

        handleClientAddedOrUpdated(); 
        setLocationsByClient(prev => {
          const newLocations = {...prev};
          delete newLocations[itemToDelete.id];
          return newLocations;
        });
        setLocationsPendingDeletion([]);

      } else if (itemToDelete.type === 'location' && itemToDelete.clientId) {
        await deleteDoc(doc(db, 'locations', itemToDelete.id));
        toast({ title: "Location Deleted", description: `Location "${itemToDelete.name}" has been deleted.` });
        handleLocationAddedOrUpdated(itemToDelete.clientId); 
      }
      setIsConfirmDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(`Error deleting ${itemToDelete.type}:`, error);
      toast({ title: "Error", description: `Could not delete ${itemToDelete.type}. Please try again.`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
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
          <CardDescription>Manage client information and their associated job locations. Click a client to view/manage their locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClients && !clients.length ? ( // Show main loader only if no clients loaded yet
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading clients...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Data</p>
              <p className="text-sm text-center max-w-md">{error}</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No clients found. Click "Add New Client" to get started.</p>
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
                        <div 
                            role="button" 
                            tabIndex={0} 
                            aria-label={`Edit client ${client.name}`}
                            onClick={(e) => { e.stopPropagation(); handleOpenEditClientDialog(client); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleOpenEditClientDialog(client); e.preventDefault(); }}}
                            className="p-1.5 rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-pointer"
                        >
                            <Edit3 className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            <span className="sr-only">Edit Client</span>
                        </div>
                        <div 
                            role="button" 
                            tabIndex={0} 
                            aria-label={`Delete client ${client.name}`}
                            onClick={(e) => { e.stopPropagation(); openDeleteConfirmation({id: client.id, name: client.name, type: 'client'}); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openDeleteConfirmation({id: client.id, name: client.name, type: 'client'}); e.preventDefault(); }}}
                            className="p-1.5 rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                            <span className="sr-only">Delete Client</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 px-4 bg-muted/30 rounded-b-md">
                    {isLoadingLocations[client.id] ? (
                      <div className="flex items-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                        <span>Loading locations...</span>
                      </div>
                    ) : (locationsByClient[client.id] && locationsByClient[client.id].length > 0) ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Locations for {client.name}:</h4>
                        <ul className="space-y-2">
                          {locationsByClient[client.id].map((location) => (
                            <li key={location.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 group">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span>{location.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEditLocationDialog(location)} className="h-7 w-7 p-0 hover:text-primary">
                                  <Edit3 className="h-4 w-4" />
                                  <span className="sr-only">Edit Location</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openDeleteConfirmation({id: location.id, name: location.name, type: 'location', clientId: client.id})} className="h-7 w-7 p-0 hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Location</span>
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenAddLocationDialog(client)}
                            className="mt-3"
                          >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Location for {client.name}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-2">No locations found for {client.name}.</p>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenAddLocationDialog(client)}
                          >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Location
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

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

      {currentClientForLocationAdd && (
        <AddLocationDialog
          isOpen={isAddLocationDialogOpen}
          onOpenChange={setIsAddLocationDialogOpen}
          clientId={currentClientForLocationAdd.id}
          clientName={currentClientForLocationAdd.name}
          onLocationAdded={() => handleLocationAddedOrUpdated(currentClientForLocationAdd.id)}
        />
      )}

      {locationToEdit && (
        <EditLocationDialog
            isOpen={isEditLocationDialogOpen}
            onOpenChange={setIsEditLocationDialogOpen}
            location={locationToEdit}
            onLocationUpdated={() => {
                setLocationToEdit(null);
                handleLocationAddedOrUpdated(locationToEdit.clientId);
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

