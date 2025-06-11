import { Aperture } from 'lucide-react';
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
      <Aperture className="h-7 w-7 text-accent" />
      <span>FE Timesheets</span>
    </Link>
  );
}
