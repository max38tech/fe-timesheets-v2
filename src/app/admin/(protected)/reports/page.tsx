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
import { collection, query, where, orderBy, getDocs, doc, getDoc, QueryConstraint } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmployeeProfile } from '@/app/admin/(protected)/employees/page';

interface Client { id: string; name: string; }
interface Location { id: string; name: string; clientId: string; }
interface TimeEntry { id: string; entryDate: string; startTime: string; endTime: string; workDurationSeconds: number; clientId: string; locationId: string; technicianId: string; }
interface ReportRow { id: string; entryDate: string; clientName: string; locationName: string; technicianName: string; startTimeFormatted: string; endTimeFormatted: string; durationFormatted: string; }

export default function ReportsPage() {
  // Date filters
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Other filters
  const [techId, setTechId] = useState<string>('all');
  const [clientId, setClientId] = useState<string>('all');
  const [locationId, setLocationId] = useState<string>('all');

  // Data state
  const [technicians, setTechnicians] = useState<EmployeeProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // fetch technicians and clients
    async function fetchFilters() {
      try {
        const userSnap = await getDocs(query(collection(db,'users'), where('role','==','technician'), orderBy('displayName')));
        setTechnicians(userSnap.docs.map(d=>({ uid:d.id, ...(d.data() as any) } as EmployeeProfile)));
      } catch {
        toast({ title:'Error', description:'Loading technicians failed', variant:'destructive' });
      }
      try {
        const clientSnap = await getDocs(query(collection(db,'clients'), orderBy('name')));
        setClients(clientSnap.docs.map(d=>({ id:d.id, name:d.data().name as string } as Client)));
      } catch {
        toast({ title:'Error', description:'Loading clients failed', variant:'destructive' });
      }
    }
    fetchFilters();
  }, [toast]);

  useEffect(() => {
    if (clientId === 'all') { setLocations([]); setLocationId('all'); return; }
    async function fetchLocs() {
      try {
        const locSnap = await getDocs(query(collection(db,'locations'), where('clientId','==',clientId), orderBy('name')));
        setLocations(locSnap.docs.map(d=>({ id:d.id, name:d.data().name as string, clientId:d.data().clientId as string } as Location)));
      } catch {
        toast({ title:'Error', description:'Loading locations failed', variant:'destructive' });
      }
    }
    fetchLocs();
  }, [clientId, toast]);

  async function handleGenerate() {
    setLoading(true); setError(null); setRows([]); setTotalSeconds(0);
    try {
      const startStr = format(startDate,'yyyy-MM-dd');
      const endStr = format(endDate,'yyyy-MM-dd');
      const constraints: QueryConstraint[] = [ where('entryDate','>=',startStr), where('entryDate','<=',endStr) ];
      if (techId!=='all') constraints.push(where('technicianId','==',techId));
      if (clientId!=='all') {
        if (locationId!=='all') constraints.push(where('locationId','==',locationId)); else constraints.push(where('clientId','==',clientId));
      }
      constraints.push(orderBy('entryDate','asc'), orderBy('startTime','asc'));
      const snap = await getDocs(query(collection(db,'timeEntries'), ...constraints));
      const entries = snap.docs.map(d=>({ ...(d.data() as TimeEntry), id:d.id }));
      if (entries.length===0) { toast({ title:'No Data', description:'No entries found' }); setLoading(false); return; }

      let sum=0; const report:ReportRow[] = [];
      for (let e of entries) {
        sum += e.workDurationSeconds||0;
        // lookup names
        let cName='N/A', lName='N/A', tName=`User: ${e.technicianId}`;
        try { const ud=await getDoc(doc(db,'users',e.technicianId)); if(ud.exists()) tName=ud.data().displayName||ud.data().email||tName; } catch{}
        try { if(e.clientId){ const cd=await getDoc(doc(db,'clients',e.clientId)); if(cd.exists()) cName=cd.data().name; } } catch{}
        try { if(e.locationId){ const ld=await getDoc(doc(db,'locations',e.locationId)); if(ld.exists()) lName=ld.data().name; } } catch{}
        report.push({ id:e.id, entryDate:e.entryDate, clientName:cName, locationName:lName, technicianName:tName, startTimeFormatted:e.startTime?format(parseISO(e.startTime),'HH:mm'): 'N/A', endTimeFormatted:e.endTime?format(parseISO(e.endTime),'HH:mm'):'N/A', durationFormatted: formatDuration(e.workDurationSeconds||0) });
      }
      setRows(report); setTotalSeconds(sum);
      toast({ title:'Report Generated', description:`${report.length} records` });
    } catch (err:any) {
      setError(err.message||'Failed'); toast({ title:'Error', description:'Report generation failed', variant:'destructive' });
    } finally { setLoading(false); }
  }

  function handleDownload() {
    if (!rows.length) { toast({ title:'No Data', description:'Generate first', variant:'destructive' }); return; }
    const headers=['Date','Client','Location','Tech','Start','End','Duration'];
    const csv=[headers.join(',')]; rows.forEach(r=>{ csv.push([r.entryDate,r.clientName,r.locationName,r.technicianName,r.startTimeFormatted,r.endTimeFormatted,r.durationFormatted].map(v=>`"${v}"`).join(',')); });
    const uri='data:text/csv;charset=utf-8,'+encodeURI(csv.join('\n'));
    const a=document.createElement('a'); a.href=uri; a.download=`report_${format(startDate,'yyyyMMdd')}_to_${format(endDate,'yyyyMMdd')}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast({ title:'Download Started' });
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Generate Time Entry Report</CardTitle>
          <CardDescription>Select dates and filters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Start Date</label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" onClick={()=>setStartOpen(true)}>
                    <CalendarIcon className="mr-2 w-4 h-4" />{format(startDate,'LLL dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={d=>{ if(d){ setStartDate(d); setEndDate(d); resetReportState(); setStartOpen(false);} }} />
                </PopoverContent>
              </Popover>
            </div>
            {/* End Date */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">End Date</label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" onClick={()=>setEndOpen(true)}>
                    <CalendarIcon className="mr-2 w-4 h-4" />{format(endDate,'LLL dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={d=>{ if(d){ setEndDate(d); resetReportState(); setEndOpen(false);} }} />
                </PopoverContent>
              </Popover>
            </div>
            {/* Client */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Client</label>
              <Select value={clientId} onValueChange={v=>{ setClientId(v); resetReportState(); }}>
                <SelectTrigger className="w-full"><Briefcase className="mr-2 w-4 h-4"/><SelectValue placeholder="All Clients"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Location */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Location</label>
              <Select value={locationId} onValueChange={v=>{ setLocationId(v); resetReportState(); }} disabled={clientId==='all'}>
                <SelectTrigger className="w-full"><MapPin className="mr-2 w-4 h-4"/><SelectValue placeholder="All Locations"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(l=><SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Technician */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Technician</n              </label>
              <Select value={techId} onValueChange={v=>{ setTechId(v); resetReportState(); }}>
                <SelectTrigger className="w-full"><Users className="mr-2 w-4 h-4"/><SelectValue placeholder="All Technicians"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map(t=><SelectItem key={t.uid} value={t.uid}>{t.displayName||t.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="col-span-full sm:col-auto">
              {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin"/> : <Search className="mr-2 w-4 h-4"/>} Generate
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Results */}
      {error && <Card className="mb-4"><CardContent><AlertTriangle className="mr-2 inline"/> {error}</CardContent></Card>}
      {rows.length>0 && <Card>
        <CardHeader>
          <CardTitle>Report Results</CardTitle>
          <CardDescription>From {format(startDate,'LLL d, yyyy')} to {format(endDate,'LLL d, yyyy')} ({rows.length} entries, total {formatDuration(totalSeconds)})</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Location</TableHead><TableHead>Tech</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead className="text-right">Duration</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map(r=><TableRow key={r.id}><TableCell>{format(new Date(r.entryDate),'LLL d, yyyy')}</TableCell><TableCell>{r.clientName}</TableCell><TableCell>{r.locationName}</TableCell><TableCell>{r.technicianName}</TableCell><TableCell>{r.startTimeFormatted}</TableCell><TableCell>{r.endTimeFormatted}</TableCell><TableCell className="text-right">{r.durationFormatted}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          <Button onClick={handleDownload} variant="outline" className="mt-4"><Download className="mr-2 w-4 h-4"/>Download CSV</Button>
        </CardContent>
      </Card>}
    </div>
  );
}
