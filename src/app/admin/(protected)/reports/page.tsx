"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, CalendarIcon, Loader2, AlertTriangle, Search, Download, Users, Briefcase, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn, formatDuration } from "@/lib/utils";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, type Timestamp, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmployeeProfile } from '@/app/admin/(protected)/employees/page';

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
  endTime: string;   // ISO string
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
  // Date filters
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isStartPickerOpen, setIsStartPickerOpen] = useState(false);
  const [isEndPickerOpen, setIsEndPickerOpen] = useState(false);

  // Other filters
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");

  // Data and UI state
  const [technicians, setTechnicians] = useState<EmployeeProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [totalReportDurationSeconds, setTotalReportDurationSeconds] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchFilterData() {
      try {
        const usersRef = collection(db, 'users');
        const techQ = query(usersRef, where('role', '==', 'technician'), orderBy('displayName', 'asc'));
        const techSnap = await getDocs(techQ);
        setTechnicians(techSnap.docs.map(d => ({ uid: d.id, ...d.data() } as EmployeeProfile)));
      } catch (err) {
        toast({ title: "Error Fetching Technicians", description: "Could not load technicians.", variant: "destructive" });
      }
      try {
        const clientsRef = collection(db, 'clients');
        const clientQ = query(clientsRef, orderBy('name', 'asc'));
        const clientSnap = await getDocs(clientQ);
        setClients(clientSnap.docs.map(d => ({ id: d.id, name: (d.data().name as string) } as Client)));
      } catch (err) {
        toast({ title: "Error Fetching Clients", description: "Could not load clients.", variant: "destructive" });
      }
    }
    fetchFilterData();
  }, [toast]);

  useEffect(() => {
    async function fetchLocations() {
      if (selectedClientId === 'all') {
        setLocations([]);
        setSelectedLocationId('all');
        return;
      }
      try {
        const locRef = collection(db, 'locations');
        const locQ = query(locRef, where('clientId', '==', selectedClientId), orderBy('name', 'asc'));
        const locSnap = await getDocs(locQ);
        setLocations(locSnap.docs.map(d => ({ id: d.id, name: d.data().name as string, clientId: d.data().clientId as string } as Location)));
      } catch {
        toast({ title: "Error Fetching Locations", description: "Could not load locations.", variant: "destructive" });
        setLocations([]);
      }
    }
    fetchLocations();
  }, [selectedClientId, toast]);

  const resetReportState = () => {
    setReportGenerated(false);
    setReportData([]);
    setError(null);
    setTotalReportDurationSeconds(0);
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportGenerated(true);
    setReportData([]);
    setTotalReportDurationSeconds(0);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const timeRef = collection(db, 'timeEntries');
      const constraints: QueryConstraint[] = [
        where('entryDate', '>=', startStr),
        where('entryDate', '<=', endStr),
      ];
      if (selectedTechnicianId !== 'all') constraints.push(where('technicianId', '==', selectedTechnicianId));
      if (selectedClientId !== 'all') {
        if (selectedLocationId !== 'all') constraints.push(where('locationId', '==', selectedLocationId));
        else constraints.push(where('clientId', '==', selectedClientId));
      }
      constraints.push(orderBy('entryDate', 'asc'), orderBy('startTime', 'asc'));
      const q = query(timeRef, ...constraints);
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...(d.data() as TimeEntry) }));
      if (entries.length === 0) {
        toast({ title: "No Data Found", description: "No time entries for criteria." });
        setIsLoading(false);
        return;
      }
      let totalSec = 0;
      entries.forEach(e => totalSec += e.workDurationSeconds || 0);
      setTotalReportDurationSeconds(totalSec);
      const rows: ReportRow[] = [];
      for (const e of entries) {
        let clientName = 'N/A';
        let locName = 'N/A';
        let techName = `User: ${e.technicianId}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', e.technicianId));
          if (userDoc.exists()) techName = userDoc.data().displayName || userDoc.data().email || techName;
        } catch {}
        try {
          if (e.clientId) {
            const cDoc = await getDoc(doc(db, 'clients', e.clientId));
            if (cDoc.exists()) clientName = cDoc.data().name || clientName;
          }
          if (e.locationId) {
            const lDoc = await getDoc(doc(db, 'locations', e.locationId));
            if (lDoc.exists()) locName = lDoc.data().name || locName;
          }
        } catch {}
        rows.push({
          id: e.id,
          entryDate: e.entryDate,
          clientName,
          locationName: locName,
          technicianNameOrEmail: techName,
          startTimeFormatted: e.startTime ? format(parseISO(e.startTime), 'HH:mm:ss') : 'N/A',
          endTimeFormatted: e.endTime ? format(parseISO(e.endTime), 'HH:mm:ss') : 'N/A',
          workDurationFormatted: typeof e.workDurationSeconds === 'number' ? formatDuration(e.workDurationSeconds) : 'N/A',
        });
      }
      setReportData(rows);
      toast({ title: "Report Generated", description: `Processed ${rows.length} entries.` });
    } catch (err: any) {
      setError(err.message || 'Report generation failed.');
      toast({ title: "Report Generation Failed", description: error || undefined, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!reportGenerated || reportData.length === 0) {
      toast({ title: "No Data to Download", description: "Generate a report first.", variant: 'destructive' });
      return;
    }
    const headers = ["Date","Client","Location","Technician","Start Time","End Time","Duration"];
    const rows = reportData.map(r => [
      r.entryDate,
      r.clientName,
      r.locationName,
      r.technicianNameOrEmail,
      r.startTimeFormatted,
      r.endTimeFormatted,
      r.workDurationFormatted,
    ]);
    let csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n';
    csv += rows.map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(',')).join('\n');
    const uri = encodeURI(csv);
    const a = document.createElement('a');
    a.href = uri;
    a.download = `report_${format(startDate,'yyyyMMdd')}_to_${format(endDate,'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Download Started" });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" /> Reporting
        </h1>
      </div>
      <Card className="shadow-md mb-6">
        <CardHeader>
          <CardTitle>Generate Time Entry Report</n          </CardTitle>
          <CardDescription>Select criteria to view time entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
              <Popover open={isStartPickerOpen} onOpenChange={setIsStartPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" onClick={() => setIsStartPickerOpen(true)} className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(startDate,'LLL dd, y')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setEndDate(d); setIsStartPickerOpen(false); resetReportState(); }} />
                </PopoverContent>
              </Popover>
            </div>
            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
              <Popover open={isEndPickerOpen} onOpenChange={setIsEndPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" onClick={() => setIsEndPickerOpen(true)} className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(endDate,'LLL dd, y')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndPickerOpen(false); resetReportState(); }} />
                </PopoverContent>
              </Popover>
            </div>
            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Client</label>
              <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedLocationId('all'); resetReportState(); }}>
                <SelectTrigger className="w-full"><Briefcase className="mr-2 h-4 w-4"/><SelectValue placeholder="All Clients"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
              <Select value={selectedLocationId} onValueChange={(v) => { setSelectedLocationId(v); resetReportState(); }} disabled={selectedClientId==='all'}>
                <SelectTrigger className="w-full"><MapPin className="mr-2 h-4 w-4"/><SelectValue placeholder="All Locations"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Technician */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Technician</label>
              <Select value={selectedTechnicianId} onValueChange={(v) => { setSelectedTechnicianId(v); resetReportState(); }}>
                <SelectTrigger className="w-full"><Users className="mr-2 h-4 w-4"/><SelectValue placeholder="All Technicians"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map(t => <SelectItem key={t.uid} value={t.uid}>{t.displayName || t.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full sm:w-auto col-span-4">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>} Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Render Report Results...
         (Unchanged except using startDate and endDate for heading) */}
    </div>
);