
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCircle, Loader2, UserCog, ShieldQuestion, Settings } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import React, { useState } from "react"; 
import Link from "next/link";

export function UserNav() {
  const { currentUser, loading, logout, userRole, userStatus } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false); 

  React.useEffect(() => {
    // console.log('UserNavEFFECT: currentUser:', currentUser ? currentUser.uid : null, 'userStatus:', userStatus, 'loading:', loading, 'userRole:', userRole);
  }, [currentUser, userStatus, loading, userRole]);

  if (loading) {
    return (
       <Button variant="ghost" className="relative h-10 w-10 rounded-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  if (!currentUser) {
    return null;
  }

  const getInitials = (email?: string | null) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const userDisplayName = currentUser.displayName || currentUser.email || "User";
  const userEmail = currentUser.email || "No email available";
  const displayRole = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "Unknown Role";

  const profileLink = userRole === 'admin'
    ? '/admin/profile'
    : userRole === 'technician'
    ? '/technician/profile'
    : null;

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false); 
  };

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentUser.photoURL || "https://placehold.co/40x40.png"} alt={userDisplayName} data-ai-hint="profile avatar" className="object-cover" />
            <AvatarFallback>
              {getInitials(currentUser.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userDisplayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
             <p className="text-xs leading-none text-muted-foreground mt-0.5">
              Status: <span className="font-medium">{userStatus ? (userStatus.charAt(0).toUpperCase() + userStatus.slice(1)) : 'Unknown'}</span>
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
           <DropdownMenuItem disabled className="opacity-100">
            {userRole === 'admin' ? <UserCog className="mr-2 h-4 w-4 text-primary" /> :
             userRole === 'technician' ? <UserCircle className="mr-2 h-4 w-4 text-primary" /> :
             <ShieldQuestion className="mr-2 h-4 w-4 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">Role:</span>
            <span className="ml-1 font-medium">{displayRole}</span>
          </DropdownMenuItem>
          {profileLink && (
            <Link href={profileLink} passHref legacyBehavior>
              <DropdownMenuItem onClick={() => setIsMenuOpen(false)}> 
                <Settings className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </DropdownMenuItem>
            </Link>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    