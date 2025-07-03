import { Building2 } from "lucide-react";
import Link from "next/link";

export function AppLogo() {
  return (
    <Link
      href="/"
      className="flex items-center space-x-2"
    >
      {/* We wrap the icon and text in a single <span> 
        to solve the "multiple children" error.
      */}
      <span className="flex items-center space-x-2">
        <Building2 />
        <span className="font-bold inline-block">FE Timesheets</span>
      </span>
    </Link>
  );
}