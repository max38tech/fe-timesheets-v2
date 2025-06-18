
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthProvider } from "@/context/auth-context"; // Added AuthProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FE Timesheets',
  description: 'Technician Time Tracking & Management System',
};

// Inside src/app/layout.tsx

// Inside src/app/layout.tsx

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontMono.variable
        )}
      >
        {/* We are commenting out the providers to see if one of them is the cause */}
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        > */}
          {/* <AuthProvider> */}
            {/* <SidebarProvider> */}
              {children}
              {/* <Toaster /> */}
            {/* </SidebarProvider> */}
          {/* </AuthProvider> */}
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}