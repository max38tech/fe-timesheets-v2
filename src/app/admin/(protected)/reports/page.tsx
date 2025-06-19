"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, QueryConstraint } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Search, Download, Users, Briefcase, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface Client { id: string; name: string; }
interface Location { id: string; name: string; clientId: string; }
interface TimeEntry { id: string; entryDate: string; startTime: string; endTime: string; workDurationSeconds: number; clientId: string; locationId: string; technicianId: string; }
interface ReportRow { id: string; entryDate: string; clientName: string; locationName: string; technicianName: string; startTime: string; endTime: string; duration: string; }

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const [techId, setTechId] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [locationId, setLocationId] = useState('all');

  const [technicians, setTechnicians] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSec, setTotalSec] = useState(0);
  const { toast } = useToast();

  const resetReportState = () => {
    setRows([]);
    setError(null);
    setTotalSec(0);
  };

  useEffect(() => {
    async function loadFilters() {
      try {
        const userSnap = await getDocs(query(collection(db,'users'), where('role','==','technician'), orderBy('displayName')));
        setTechnicians(userSnap.docs.map(d=>({ uid:d.id, ...(d.data() as any) })));
      } catch {}
      try {
        const clientSnap = await getDocs(query(collection(db,'clients'), orderBy('name')));
        setClients(clientSnap.docs.map(d=>({ id:d.id, name:d.data().name as string })));
      } catch {}
    }
    loadFilters();
  }, []);

  useEffect(() => {
    if (clientId === 'all') { setLocations([]); setLocationId('all'); return; }
    async function loadLoc() {
      try {
        const locSnap = await getDocs(query(collection(db,'locations'), where('clientId','==',clientId), orderBy('name')));
        setLocations(locSnap.docs.map(d=>({ id:d.id,name:d.data().name as string,clientId:d.data().clientId as string })));
      } catch {}
    }
    loadLoc();
  }, [clientId]);

  async function handleGenerate() {
    resetReportState();
    setLoading(true);
    try {
      const constraints: QueryConstraint[] = [ where('entryDate','>=',format(startDate,'yyyy-MM-dd')), where('entryDate','<=',format(endDate,'yyyy-MM-dd')) ];
      if (techId!=='all') constraints.push(where('technicianId','==',techId));
      if (clientId!=='all') {
        if (locationId!=='all') constraints.push(where('locationId','==',locationId)); else constraints.push(where('clientId','==',clientId));
      }
      constraints.push(orderBy('entryDate','asc'), orderBy('startTime','asc'));
      const snap = await getDocs(query(collection(db,'timeEntries'), ...constraints));
      const entries = snap.docs.map(d=>({ ...(d.data() as TimeEntry), id:d.id }));
      if (!entries.length) { setError('No entries found'); return; }
      const out: ReportRow[] = [];
      let sum=0;
      for (let e of entries) {
        sum += e.workDurationSeconds||0;
        // names
        let cName='N/A', lName='N/A', tName=`User ${e.technicianId}`;
        try { const ud=await getDoc(doc(db,'users',e.technicianId)); if(ud.exists()) tName = ud.data().displayName||ud.data().email||tName; } catch{}
        try { if(e.clientId){ const cd=await getDoc(doc(db,'clients',e.clientId)); if(cd.exists()) cName=cd.data().name; }} catch{}
        try { if(e.locationId){ const ld=await getDoc(doc(db,'locations',e.locationId)); if(ld.exists()) lName=ld.data().name; }} catch{}
        out.push({ id:e.id, entryDate:e.entryDate, clientName:cName, locationName:lName, technicianName:tName, startTime: format(parseISO(e.startTime),'HH:mm'), endTime: format(parseISO(e.endTime),'HH:mm'), duration: formatDuration(e.workDurationSeconds||0) });
      }
      setRows(out);
      setTotalSec(sum);
    } catch (err:any) {
      setError(err.message||'Failed');
    } finally { setLoading(false); }
  }

  function handleDownload() {
    if (!rows.length) return;
    const headers=['Date','Client','Location','Tech','Start','End','Duration'];
    const csv = [headers.join(',')];
    rows.forEach(r=> csv.push([r.entryDate,r.clientName,r.locationName,r.technicianName,r.startTime,r.endTime,r.duration].map(v=>`"${v}"`).join(',')));
    const uri='data:text/csv;charset=utf-8,'+encodeURI(csv.join('\n'));
    const a=document.createElement('a'); a.href=uri; a.download=`report_${format(startDate,'yyyyMMdd')}_to_${format(endDate,'yyyyMMdd')}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Generate Time Entry Report</CardTitle>
          <CardDescription>Pick dates and filters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Start */}
            <div>
              <label className="block mb-1 text-sm text-muted-foreground">Start Date</label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" onClick={()=>setStartOpen(true)} className="w-full justify-start"> <CalendarIcon className="mr-2 w-4 h-4"/>{format(startDate,'LLL dd, yyyy')} </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={d=>d&&([setStartDate(d), setEndDate(d), resetReportState(), setStartOpen(false)])} />
                </PopoverContent>
              </Popover>
            </div>
            {/* End */}
            <div>
              <label className="block mb-1 text-sm text-muted-foreground">End Date</label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" onClick={()=>setEndOpen(true)} className="w-full justify-start"> <CalendarIcon className="mr-2 w-4 h-4"/>{format(endDate,'LLL dd, yyyy')} </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={d=>d&&([setEndDate(d), resetReportState(), setEndOpen(false)])} />
                </PopoverContent>
              </Popover>
            </div>
            {/* Client */}
            <div>
              <label className="block mb-1 text-sm text-muted-foreground">Client</label>
              <Select value={clientId} onValueChange={v=>[setClientId(v), resetReportState()]}> <SelectTrigger className="w-full"><Briefcase className="mr-2 w-4 h-4"/><SelectValue placeholder="All Clients"/></SelectTrigger>
                <SelectContent><SelectItem value="all">All Clients</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Location */}
            <div>
              <label className="block mb-1 text-sm text-muted-foreground">Location</label>
              <Select value={locationId} onValueChange={v=>[setLocationId(v), resetReportState()]} disabled={clientId==='all'}>
                <SelectTrigger className="w-full"><MapPin className="mr-2 w-4 h-4"/><SelectValue placeholder="All Locations"/></SelectTrigger>
                <SelectContent><SelectItem value="all">All Locations</SelectItem>{locations.map(l=><SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Tech */}
            <div>
              <label className="block mb-1 text-sm text-muted-foreground">Technician</label>
              <Select value={techId} onValueChange={v=>[setTechId(v), resetReportState()]}> <SelectTrigger className="w-full"><Users className="mr-2 w-4 h-4"/><SelectValue placeholder="All Technicians"/></SelectTrigger>
                <SelectContent><SelectItem value="all">All Technicians</SelectItem>{technicians.map(t=><SelectItem key={t.uid} value={t.uid}>{t.displayName||t.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="col-span-full sm:col-span-4">{loading?<Loader2 className="mr-2 w-4 h-4 animate-spin"/>:<Search className="mr-2 w-4 h-4"/>} Generate</Button>
          </div>
        </CardContent>
      </Card>
      {error && <Card className="mb-4"><CardContent><AlertTriangle className="inline mr-2"/>{error}</CardContent></Card>}
      {rows.length>0 && <Card>
        <CardHeader><CardTitle>Report: {format(startDate,'LLL d')} - {format(endDate,'LLL d')}</CardTitle><CardDescription>{rows.length} entries, total {formatDuration(totalSec)}</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto"> <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Location</TableHead><TableHead>Technician</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead className="text-right">Duration</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map(r=><TableRow key={r.id}><TableCell>{r.entryDate}</TableCell><TableCell>{r.clientName}</TableCell><TableCell>{r.locationName}</TableCell><TableCell>{r.technicianName}</TableCell><TableCell>{r.startTime}</TableCell><TableCell>{r.endTime}</TableCell><TableCell className="text-right">{r.duration}</TableCell></TableRow>)}</TableBody>
          </Table></div>
          <Button onClick={handleDownload} variant="outline" className="mt-4"><Download className="mr-2 w-4 h-4"/>Download CSV</Button>
        </CardContent>
      </Card>}
    </div>
  );
}