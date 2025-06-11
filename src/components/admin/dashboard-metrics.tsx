
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckSquare, Briefcase, MapPin, Loader2, type LucideIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { formatDuration } from "@/lib/utils";

const iconMap: Record<string, LucideIcon | undefined> = { // Allow undefined for safety
  Users,
  Clock,
  CheckSquare,
  // Activity, // Removed Activity as it's no longer used
  Briefcase,
  MapPin,
  Loader2,
};

type MetricCardProps = {
  title: string;
  value: string | number;
  iconName: keyof typeof iconMap;
  description?: string;
  isLoading?: boolean;
};

function MetricCard({ title, value, iconName, description, isLoading = false }: MetricCardProps) {
  const IconComponent = isLoading ? iconMap["Loader2"] : iconMap[iconName];
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {IconComponent && <IconComponent className={`h-5 w-5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-2xl font-bold">-</div>
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardMetrics() {
  const [totalClients, setTotalClients] = useState<number | string>("-");
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const [totalLocations, setTotalLocations] = useState<number | string>("-");
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [pendingApprovals, setPendingApprovals] = useState<number | string>("-");
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);

  const [hoursLoggedToday, setHoursLoggedToday] = useState<string>("-");
  const [isLoadingHours, setIsLoadingHours] = useState(true);

  const [activeTechnicians, setActiveTechnicians] = useState<number | string>("-");
  const [isLoadingActiveTechnicians, setIsLoadingActiveTechnicians] = useState(true);
  

  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch Total Clients
      try {
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        setTotalClients(clientsSnapshot.size);
      } catch (error) {
        console.error("Error fetching total clients:", error);
        setTotalClients("Error");
      } finally {
        setIsLoadingClients(false);
      }

      // Fetch Total Locations
      try {
        const locationsSnapshot = await getDocs(collection(db, 'locations'));
        setTotalLocations(locationsSnapshot.size);
      } catch (error) {
        console.error("Error fetching total locations:", error);
        setTotalLocations("Error");
      } finally {
        setIsLoadingLocations(false);
      }

      // Fetch Pending Approvals
      try {
        const qApprovals = query(collection(db, 'jobSubmissions'), where('status', '==', 'pending_approval'));
        const approvalsSnapshot = await getDocs(qApprovals);
        setPendingApprovals(approvalsSnapshot.size);
      } catch (error) {
        console.error("Error fetching pending approvals:", error);
        setPendingApprovals("Error");
      } finally {
        setIsLoadingApprovals(false);
      }
      
      // Fetch Hours Logged Today
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const qHours = query(collection(db, 'timeEntries'), where('entryDate', '==', todayStr));
        const hoursSnapshot = await getDocs(qHours);
        let totalSeconds = 0;
        hoursSnapshot.forEach(doc => {
          totalSeconds += (doc.data().workDurationSeconds || 0) as number;
        });
        setHoursLoggedToday(formatDuration(totalSeconds));
      } catch (error) {
        console.error("Error fetching hours logged today:", error);
        setHoursLoggedToday("Error");
      } finally {
        setIsLoadingHours(false);
      }

      // Fetch Active Technicians
      try {
        const qActiveTechs = query(collection(db, 'users'), where('role', '==', 'technician'), where('status', '==', 'active'));
        const activeTechsSnapshot = await getDocs(qActiveTechs);
        setActiveTechnicians(activeTechsSnapshot.size);
      } catch (error) {
        console.error("Error fetching active technicians:", error);
        // Check for Firestore index error message for a more specific user hint
        if ((error as any).message && (error as any).message.toLowerCase().includes('index')) {
             setActiveTechnicians("Index needed");
        } else {
            setActiveTechnicians("Error");
        }
      } finally {
        setIsLoadingActiveTechnicians(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"> {/* Adjusted grid to xl:grid-cols-3 */}
      <MetricCard 
        title="Total Clients" 
        value={totalClients} 
        iconName="Briefcase"
        description="Registered client companies"
        isLoading={isLoadingClients}
      />
      <MetricCard 
        title="Total Locations" 
        value={totalLocations}
        iconName="MapPin"
        description="Registered job sites"
        isLoading={isLoadingLocations}
      />
       <MetricCard 
        title="Active Technicians" 
        value={activeTechnicians} 
        iconName="Users"
        description={activeTechnicians === "Index needed" ? "Firestore index required, check console" : "Technicians with 'active' status"}
        isLoading={isLoadingActiveTechnicians}
      />
      <MetricCard 
        title="Hours Logged (Today)" 
        value={hoursLoggedToday === "Error" || hoursLoggedToday === "-" ? hoursLoggedToday : `${hoursLoggedToday}`}
        iconName="Clock"
        description="Total work hours recorded today"
        isLoading={isLoadingHours}
      />
      <MetricCard 
        title="Pending Approvals" 
        value={pendingApprovals}
        iconName="CheckSquare"
        description="Submissions awaiting review"
        isLoading={isLoadingApprovals}
      />
      {/* 
        The "Recent Activities" card was removed as it was a placeholder.
        A full activity feed is a more complex feature for future consideration.
      */}
    </div>
  );
}
