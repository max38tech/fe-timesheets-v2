
"use client";

import React, { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, type Timestamp } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface TimeEntry {
  clientId: string;
  workDurationSeconds: number;
  entryDate: string; // YYYY-MM-DD
}

interface Client {
  id: string;
  name: string;
}

interface ChartDataPoint {
  clientName: string;
  totalHours: number; // Storing as hours for readability in chart
  // For tooltip:
  rawSeconds: number; 
  formattedDuration: string;
  fill: string; // Added for direct bar fill
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ClientHoursChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const sevenDaysAgo = subDays(new Date(), 7);
        const startDateStr = format(sevenDaysAgo, 'yyyy-MM-dd');
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const timeEntriesRef = collection(db, 'timeEntries');
        const q = query(
          timeEntriesRef,
          where('entryDate', '>=', startDateStr),
          where('entryDate', '<=', todayStr)
        );

        const querySnapshot = await getDocs(q);
        const timeEntriesData = querySnapshot.docs.map(d => d.data() as TimeEntry);

        if (timeEntriesData.length === 0) {
          setChartData([]);
          setIsLoading(false);
          return;
        }

        const aggregatedData: Record<string, number> = {};
        timeEntriesData.forEach(entry => {
          aggregatedData[entry.clientId] = (aggregatedData[entry.clientId] || 0) + entry.workDurationSeconds;
        });

        const clientIds = Object.keys(aggregatedData);
        const clientsMap: Record<string, string> = {};
        const clientDocsPromises = clientIds.map(id => getDoc(doc(db, 'clients', id)));
        const clientDocsSnapshots = await Promise.all(clientDocsPromises);

        clientDocsSnapshots.forEach(snap => {
          if (snap.exists()) {
            clientsMap[snap.id] = (snap.data() as Client).name || `Client ID: ${snap.id}`;
          } else {
            clientsMap[snap.id] = `Client ID: ${snap.id} (Not Found)`;
          }
        });
        
        const newChartConfig: ChartConfig = {};
        const processedChartData = Object.entries(aggregatedData)
        .map(([clientId, totalSeconds], index) => {
            const clientName = clientsMap[clientId] || `Unknown Client (${clientId.substring(0,5)})`;
            const colorKey = `client${index + 1}`; // Use a dynamic key for chartConfig
            newChartConfig[colorKey] = { // Store name with dynamic key
              label: clientName,
              color: CHART_COLORS[index % CHART_COLORS.length],
            };
            return {
              clientName: clientName, // Used for XAxis dataKey
              totalHours: parseFloat((totalSeconds / 3600).toFixed(2)), 
              rawSeconds: totalSeconds,
              formattedDuration: formatDuration(totalSeconds),
              fill: `var(--color-${colorKey})` // Use the same dynamic key for fill
            };
          })
          .sort((a, b) => b.totalHours - a.totalHours);

        setChartConfig(newChartConfig);
        setChartData(processedChartData);

      } catch (err: any) {
        console.error("Error fetching chart data:", err);
        let detailedError = "Failed to load chart data.";
        if (err.code && (err.code.includes('failed-precondition') || err.message.toLowerCase().includes('index'))) {
            detailedError = "The query requires a Firestore index on 'timeEntries' for 'entryDate'. Please create it in the Firebase console.";
        }
        setError(detailedError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Hours Logged Per Client (Last 7 Days)
          </CardTitle>
          <CardDescription>Aggregating data, please wait...</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            Error Loading Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex flex-col items-center justify-center">
          <p className="text-destructive mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">Please try refreshing or check Firestore console for index requirements.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (chartData.length === 0) {
     return (
      <Card className="shadow-md">
        <CardHeader>
           <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Hours Logged Per Client (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">No time entries found for the last 7 days to display in the chart.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Hours Logged Per Client (Last 7 Days)
        </CardTitle>
        <CardDescription>
          Total work hours recorded for each client over the past week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}> {/* Increased bottom margin */}
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="clientName"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                angle={-45} // Rotate labels
                textAnchor="end" // Anchor rotated labels at their end
                height={80} // Increased height to accommodate rotated labels
                interval={0} // Show all labels
                tickFormatter={(value: string) => value.length > 15 ? `${value.substring(0,13)}...` : value } // Truncate long labels
              />
              <YAxis 
                label={{ value: 'Total Hours', angle: -90, position: 'insideLeft', offset:-5 }}
                tickFormatter={(value) => `${value}h`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent 
                    formatter={(value, name, props) => {
                      const dataPoint = props.payload as ChartDataPoint;
                      return (
                        <div className="flex flex-col gap-0.5">
                           <span className="font-semibold text-foreground">{dataPoint.clientName}</span>
                           <span className="text-muted-foreground">Total Logged: {dataPoint.formattedDuration}</span>
                        </div>
                      );
                    }}
                    hideLabel 
                  />
                }
              />
               <Bar dataKey="totalHours" radius={4}>
                {chartData.map((entry, index) => (
                  // The Bar component itself handles rendering based on dataKey and `fill` from chartConfig mapping or direct `fill` in data.
                  // This div structure for individual cells is not how recharts Bar works.
                  // Instead, ensure `fill` attribute in `ChartDataPoint` is correctly mapping colors.
                  (<div key={`cell-${index}`} style={{ backgroundColor: entry.fill }} />)
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
