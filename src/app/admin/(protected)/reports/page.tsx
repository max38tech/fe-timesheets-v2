
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, CalendarIcon, Loader2, AlertTriangle, Search, Download, Users, Briefcase, MapPin } from "lucide-react";
import { format, type DateRange, parseISO } from "date-fns";
import { cn, formatDuration } from "@/lib/utils";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, type Timestamp, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmployeeProfile } from '@/app/admin/employees/page'; 

interface Client {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  clientId: string;
}

interface TimeEntry {
  id: string;
  entryDate: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime: string; // ISO string
  workDurationSeconds: number;
  clientId: string;
  locationId: string;
  technicianId: string;
}

interface ReportRow {
  id: string;
  entryDate: string;
  clientName: string;
  locationName: string;
  technicianNameOrEmail: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  workDurationFormatted: string;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const rangeClickCount = useRef(0);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false); // For date picker popover
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");

  const [technicians, setTechnicians] = useState<EmployeeProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]); // Locations for the selected client

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [totalReportDurationSeconds, setTotalReportDurationSeconds] = useState<number>(0);
  const { toast } = useToast();

  // Fetch technicians and clients on component mount
  useEffect(() => {
    const fetchFilterData = async () => {
      // Fetch Technicians
      try {
        const usersCollectionRef = collection(db, 'users');
        const techQuery = query(usersCollectionRef, where('role', '==', 'technician'), orderBy('displayName', 'asc'));
        const techSnapshot = await getDocs(techQuery);
        const fetchedTechnicians = techSnapshot.docs.map(d => ({
          uid: d.id,
          ...d.data(),
        } as EmployeeProfile));
        setTechnicians(fetchedTechnicians);
      } catch (err) {
        console.error("Error fetching technicians:", err);
        toast({
          title: "Error Fetching Technicians",
          description: "Could not load list of technicians for filtering. Ensure 'role' field exists and is indexed.",
          variant: "destructive",
        });
      }

      // Fetch Clients
      try {
        const clientsCollectionRef = collection(db, 'clients');
        const clientQuery = query(clientsCollectionRef, orderBy('name', 'asc'));
        const clientSnapshot = await getDocs(clientQuery);
        const fetchedClients = clientSnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name as string,
        }));
        setClients(fetchedClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        toast({
          title: "Error Fetching Clients",
          description: "Could not load list of clients for filtering.",
          variant: "destructive",
        });
      }
    };
    fetchFilterData();
  }, [toast]);

  // Fetch locations when selectedClientId changes
  useEffect(() => {
    const fetchLocations = async () => {
      if (selectedClientId === "all" || !selectedClientId) {
        setLocations([]);
        setSelectedLocationId("all"); // Reset location if client is "all"
        return;
      }
      setIsLoading(true); 
      try {
        const locationsCollectionRef = collection(db, 'locations');
        const locQuery = query(locationsCollectionRef, where('clientId', '==', selectedClientId), orderBy('name', 'asc'));
        const locSnapshot = await getDocs(locQuery);
        const fetchedLocations = locSnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name as string,
          clientId: d.data().clientId as string,
        }));
        setLocations(fetchedLocations);
      } catch (err) {
        console.error(`Error fetching locations for client ${selectedClientId}:`, err);
        toast({
          title: "Error Fetching Locations",
          description: "Could not load locations for the selected client.",
          variant: "destructive",
        });
        setLocations([]);
      } finally {
        setIsLoading(false); 
      }
    };

    fetchLocations();
  }, [selectedClientId, toast]);

  const resetReportState = () => {
    setReportGenerated(false);
    setReportData([]);
    setError(null);
    setTotalReportDurationSeconds(0);
  };

  const handleGenerateReport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Date Range Required",
        description: "Please select both a start and end date for the report.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportData([]);
    setReportGenerated(true);
    setTotalReportDurationSeconds(0); // Reset total duration at the start of generation

    try {
      const startDateStr = format(dateRange.from, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.to, 'yyyy-MM-dd');

      const timeEntriesRef = collection(db, 'timeEntries');
      const queryConstraints: QueryConstraint[] = [
        where('entryDate', '>=', startDateStr),
        where('entryDate', '<=', endDateStr),
      ];

      if (selectedTechnicianId !== "all") {
        queryConstraints.push(where('technicianId', '==', selectedTechnicianId));
      }
      if (selectedClientId !== "all") {
        if (selectedLocationId !== "all") {
          queryConstraints.push(where('locationId', '==', selectedLocationId));
        } else {
          queryConstraints.push(where('clientId', '==', selectedClientId));
        }
      }
      
      queryConstraints.push(orderBy('entryDate', 'asc'));
      queryConstraints.push(orderBy('startTime', 'asc'));


      const q = query(timeEntriesRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      const fetchedEntries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));

      if (fetchedEntries.length === 0) {
        toast({
          title: "No Data Found",
          description: "No time entries were found in the database for the selected criteria."
        });
        setReportData([]);
        setIsLoading(false);
        return;
      }
      
      let sumOfSeconds = 0;
      fetchedEntries.forEach(entry => {
        sumOfSeconds += (entry.workDurationSeconds || 0);
      });
      setTotalReportDurationSeconds(sumOfSeconds);

      const processedEntries = await Promise.all(
        fetchedEntries.map(async (entry) => {
          let clientName = 'N/A';
          let locationName = 'N/A';
          let technicianNameOrEmail = `User: ${entry.technicianId}`;


          if (!entry.technicianId) {
            technicianNameOrEmail = "Technician ID missing";
          } else {
            try {
                const userSnap = await getDoc(doc(db, 'users', entry.technicianId));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    technicianNameOrEmail = userData?.displayName || userData?.email || `Details missing for user ${entry.technicianId.substring(0,5)}`;
                } else {
                    technicianNameOrEmail = `User doc not found: ${entry.technicianId.substring(0,5)}`;
                }
            } catch (userLookupError: any) {
                console.error(`Error looking up user ${entry.technicianId}:`, userLookupError);
                 technicianNameOrEmail = `Lookup error for user ${entry.technicianId.substring(0,5)}`;
            }
          }


          try {
            if (entry.clientId) {
              const clientSnap = await getDoc(doc(db, 'clients', entry.clientId));
              clientName = clientSnap.exists() ? clientSnap.data()?.name || 'Client Name Missing' : 'Client Not Found';
            }
            if (entry.locationId) {
              const locationSnap = await getDoc(doc(db, 'locations', entry.locationId));
              locationName = locationSnap.exists() ? locationSnap.data()?.name || 'Location Name Missing' : 'Location Not Found';
            }
          } catch (lookupError: any) {
            console.error("Error looking up related client/location data for entry:", entry.id, lookupError);
          }

          return {
            id: entry.id,
            entryDate: entry.entryDate,
            clientName,
            locationName,
            technicianNameOrEmail,
            startTimeFormatted: entry.startTime ? format(parseISO(entry.startTime), 'HH:mm:ss') : 'N/A',
            endTimeFormatted: entry.endTime ? format(parseISO(entry.endTime), 'HH:mm:ss') : 'N/A',
            workDurationFormatted: typeof entry.workDurationSeconds === 'number' ? formatDuration(entry.workDurationSeconds) : 'N/A',
          };
        })
      );

      setReportData(processedEntries);

      if (fetchedEntries.length > 0 && processedEntries.length > 0) {
        toast({ title: "Report Generated", description: `Successfully processed ${processedEntries.length} entries.` });
      } else if (fetchedEntries.length > 0 && processedEntries.length === 0) {
         toast({
            title: "Processing Issue",
            description: "Fetched initial entries, but could not process them into report rows. Check data consistency or console for errors." ,
            variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error generating report:", err);
      let detailedErrorMessage = "Failed to generate report. An unexpected error occurred. Please try again or check console for details.";
      if (err.code && (err.code.includes('failed-precondition') || err.code.includes('requires-index') || (err.message && err.message.toLowerCase().includes('index')))) {
        detailedErrorMessage = "The query requires a Firestore index. Please check the browser console for a link to create it. The query involves multiple filters and ordering. Ensure indexes cover all queried fields and orderings.";
      } else if (err.message) {
        detailedErrorMessage = `Failed to generate report: ${err.message}. Check Firestore permissions and indexes.`;
      }
      setError(detailedErrorMessage);
      toast({
        title: "Report Generation Failed",
        description: detailedErrorMessage,
        variant: "destructive",
        duration: 10000, 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (reportData.length === 0 || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "No Data to Download",
        description: "Please generate a report with data first.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Date", "Client", "Location", "Technician", "Start Time", "End Time", "Duration (HH:MM:SS)"];
    const rows = reportData.map(entry => [
      entry.entryDate ? format(new Date(entry.entryDate + 'T00:00:00'), "yyyy-MM-dd") : 'N/A', 
      entry.clientName || 'N/A',
      entry.locationName || 'N/A',
      entry.technicianNameOrEmail || 'N/A',
      entry.startTimeFormatted || 'N/A',
      entry.endTimeFormatted || 'N/A',
      entry.workDurationFormatted || 'N/A'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fromDateStr = format(dateRange.from, "yyyyMMdd");
    const toDateStr = format(dateRange.to, "yyyyMMdd");
    let fileName = `timesheet_report_${fromDateStr}_to_${toDateStr}`;
    if (selectedClientId !== 'all' && clients.find(c => c.id === selectedClientId)) {
        fileName += `_client-${clients.find(c => c.id === selectedClientId)?.name.replace(/\s+/g, '-')}`;
    }
     if (selectedLocationId !== 'all' && selectedClientId !== 'all' && locations.find(l => l.id === selectedLocationId)) {
        fileName += `_location-${locations.find(l => l.id === selectedLocationId)?.name.replace(/\s+/g, '-')}`;
    }
    if (selectedTechnicianId !== 'all' && technicians.find(t => t.uid === selectedTechnicianId)) {
        fileName += `_tech-${technicians.find(t => t.uid === selectedTechnicianId)?.displayName?.replace(/\s+/g, '-') || selectedTechnicianId.substring(0,5)}`;
    }
    fileName += '.csv';
    
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Download Started", description: "Your CSV report is being downloaded." });
  };

 const renderReportContent = () => {
    if (isLoading && reportGenerated) { 
      return (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading report data...</p>
        </div>
      );
    }

    if (error && reportGenerated) { 
      return (
        <Card className="mt-6 shadow-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle /> Error Generating Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive-foreground bg-destructive/10 p-3 rounded-md">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Please ensure you have the necessary Firestore indexes and that Firestore permissions are correct. If the error mentions an index, create it via the Firebase console link usually in the browser's developer console.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (!reportGenerated) {
      return (
        <Card className="mt-6 shadow-md">
            <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
                Select criteria and click "Generate Report" to view time entries.
            </p>
            </CardContent>
        </Card>
      );
    }

    if (reportData.length > 0 && reportGenerated) {
      return (
        <Card className="mt-6 shadow-md">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Report Results</CardTitle>
              <CardDescription>
                Showing entries from {dateRange?.from ? format(dateRange.from, "LLL dd, y") : ""} to {dateRange?.to ? format(dateRange.to, "LLL dd, y") : ""}.
                {selectedClientId !== "all" && clients.find(c => c.id === selectedClientId) && 
                  ` For Client: ${clients.find(c => c.id === selectedClientId)?.name}.`
                }
                {selectedLocationId !== "all" && selectedClientId !== "all" && locations.find(l => l.id === selectedLocationId) &&
                  ` At Location: ${locations.find(l => l.id === selectedLocationId)?.name}.`
                }
                {selectedTechnicianId !== "all" && technicians.find(t => t.uid === selectedTechnicianId) && 
                  ` For Technician: ${technicians.find(t => t.uid === selectedTechnicianId)?.displayName || selectedTechnicianId}.`
                }
                <br />
                Found {reportData.length} entries. 
                <span className="font-semibold text-foreground"> Total Duration: {formatDuration(totalReportDurationSeconds)}</span>
              </CardDescription>
            </div>
            <Button onClick={handleDownloadCsv} variant="outline" size="sm" disabled={isLoading || reportData.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.entryDate ? format(new Date(entry.entryDate + 'T00:00:00'), "LLL dd, y") : 'N/A'}</TableCell>
                    <TableCell>{entry.clientName || 'N/A'}</TableCell>
                    <TableCell>{entry.locationName || 'N/A'}</TableCell>
                    <TableCell>{entry.technicianNameOrEmail || 'N/A'}</TableCell>
                    <TableCell>{entry.startTimeFormatted || 'N/A'}</TableCell>
                    <TableCell>{entry.endTimeFormatted || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      {entry.workDurationFormatted || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    if (reportGenerated && reportData.length === 0 && !error) {
        return (
          <Card className="mt-6 shadow-md">
            <CardContent className="py-10">
              <p className="text-center text-muted-foreground">
                No time entries found for the selected criteria. Verify data exists in Firestore or try different filters/dates.
              </p>
            </CardContent>
          </Card>
        );
    }
        
    return (
         <Card className="mt-6 shadow-md">
            <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
                An unexpected state was reached. Please try generating the report again.
            </p>
            </CardContent>
        </Card>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Reporting
        </h1>
      </div>

      <Card className="shadow-md mb-6">
        <CardHeader>
          <CardTitle>Generate Time Entry Report</CardTitle>
          <CardDescription>Select criteria to view time entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="date-range-picker" className="block text-sm font-medium text-muted-foreground mb-1">
                Date Range
              </label>
              <Popover open={isDatePopoverOpen} onOpenChange={(open) => {
                  // Prevent closing popover on first date click in range mode
                  if (!open && dateRange?.from && !dateRange?.to) {
                    return; // ignore close
                  }
                  if (open) rangeClickCount.current = 0;
                  setIsDatePopoverOpen(open);
              }}>
                <PopoverTrigger asChild>
                  <Button
                    id="date-range-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                    onClick={() => setIsDatePopoverOpen(true)}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      if (range?.from && range.to) {
                        resetReportState();
                        setIsDatePopoverOpen(false); 
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label htmlFor="client-selector" className="block text-sm font-medium text-muted-foreground mb-1">
                Client
              </label>
              <Select
                value={selectedClientId}
                onValueChange={(value) => {
                  setSelectedClientId(value);
                  setSelectedLocationId("all"); 
                  setLocations([]); 
                  resetReportState();
                }}
              >
                <SelectTrigger id="client-selector" className="w-full">
                  <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="location-selector" className="block text-sm font-medium text-muted-foreground mb-1">
                Location
              </label>
              <Select
                value={selectedLocationId}
                onValueChange={(value) => {
                  setSelectedLocationId(value);
                  resetReportState();
                }}
                disabled={selectedClientId === "all" || locations.length === 0}
              >
                <SelectTrigger id="location-selector" className="w-full">
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={selectedClientId === "all" ? "Select client first" : "Select location"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations for {clients.find(c=>c.id === selectedClientId)?.name || 'Client'}</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div>
              <label htmlFor="technician-selector" className="block text-sm font-medium text-muted-foreground mb-1">
                Technician
              </label>
              <Select
                value={selectedTechnicianId}
                onValueChange={(value) => {
                  setSelectedTechnicianId(value);
                  resetReportState();
                }}
              >
                <SelectTrigger id="technician-selector" className="w-full">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.uid} value={tech.uid}>
                      {tech.displayName || tech.email || tech.uid}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <Button 
              onClick={handleGenerateReport} 
              disabled={isLoading || !dateRange?.from || !dateRange?.to} 
              className="w-full sm:w-auto xl:self-end"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {renderReportContent()}

    </div>
  );
}
    
