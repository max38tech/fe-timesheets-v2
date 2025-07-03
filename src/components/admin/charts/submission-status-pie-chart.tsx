
"use client";

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2, AlertTriangle, ListChecks } from 'lucide-react';

interface SubmissionData {
  status: string;
}

interface AggregatedStatus {
  name: string;
  value: number;
  fill: string;
}

const STATUS_DISPLAY_NAMES: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'hsl(var(--chart-4))', // Yellowish
  approved: 'hsl(var(--chart-2))',         // Greenish
  rejected: 'hsl(var(--chart-1))',         // Reddish/Orange
  unknown: 'hsl(var(--muted))',         // Grey for unknown
};

export function SubmissionStatusPieChart() {
  const [chartData, setChartData] = useState<AggregatedStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const submissionsRef = collection(db, 'jobSubmissions');
        const querySnapshot = await getDocs(submissionsRef);
        const submissions = querySnapshot.docs.map(d => d.data() as SubmissionData);

        if (submissions.length === 0) {
          setChartData([]);
          setIsLoading(false);
          return;
        }

        const statusCounts: Record<string, number> = {
          pending_approval: 0,
          approved: 0,
          rejected: 0,
        };

        submissions.forEach(sub => {
          if (statusCounts[sub.status] !== undefined) {
            statusCounts[sub.status]++;
          } else {
             statusCounts['unknown'] = (statusCounts['unknown'] || 0) + 1;
          }
        });

        const newChartConfig: ChartConfig = {};
        const processedData = Object.entries(statusCounts)
          .filter(([, count]) => count > 0) // Only include statuses with data
          .map(([status, count]) => {
            const displayName = STATUS_DISPLAY_NAMES[status] || 'Unknown Status';
            newChartConfig[status] = {
              label: displayName,
              color: STATUS_COLORS[status] || STATUS_COLORS['unknown'],
            };
            return {
              name: displayName,
              value: count,
              fill: `var(--color-${status})`,
            };
          });
        
        setChartConfig(newChartConfig);
        setChartData(processedData);

      } catch (err: any) {
        console.error("Error fetching submission status data:", err);
        setError("Failed to load submission status data. Please ensure Firestore permissions are correct.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card className="shadow-md h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            Submission Statuses
          </CardTitle>
          <CardDescription>Loading data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            Error Loading Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex flex-col items-center justify-center">
          <p className="text-destructive mb-2">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-md h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            Submission Statuses
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">No job submissions found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          Submission Statuses
        </CardTitle>
        <CardDescription>Overview of job submission approval states.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0"> {/* Ensure content takes available space */}
        <ChartContainer config={chartConfig} className="aspect-square h-full max-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <Legend
                content={({ payload }) => {
                  if (!payload) return null;
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs mt-2">
                      {payload.map((entry) => (
                         <div key={entry.value} className="flex items-center gap-1.5">
                           <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                           {entry.value} ({entry.payload?.value})
                         </div>
                       ))}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
