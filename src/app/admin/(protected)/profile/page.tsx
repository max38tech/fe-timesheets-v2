
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Loader2, User, Lock, Edit, ShieldCheck, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const displayNameSchema = z.object({
  displayName: z.string().min(1, 'Display name cannot be empty.').max(100, 'Display name is too long.'),
});
type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords don't match.",
    path: ['confirmNewPassword'],
  });
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AdminProfilePage() {
  const { currentUser, userRole, userStatus, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  const [currentDisplayName, setCurrentDisplayName] = useState(currentUser?.displayName || '');
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(currentUser?.photoURL || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setCurrentDisplayName(currentUser.displayName || '');
      setCurrentPhotoURL(currentUser.photoURL || null);
      displayNameForm.reset({ displayName: currentUser.displayName || '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);


  const displayNameForm = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: {
      displayName: '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });
  
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  const handleUpdateDisplayName: SubmitHandler<DisplayNameFormValues> = async (data) => {
    if (!currentUser || !auth.currentUser) { 
        toast({ title: 'Authentication Error', description: 'Cannot update display name. Please re-login.', variant: 'destructive' });
        return;
    }
    setIsUpdatingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: data.displayName });
      
      const userDocRef = doc(db, 'users', currentUser.uid); 
      await updateDoc(userDocRef, { displayName: data.displayName });
      
      setCurrentDisplayName(data.displayName);
      toast({ title: 'Success', description: 'Display name updated successfully.' });
      displayNameForm.reset({ displayName: data.displayName }); 
    } catch (error) {
      console.error('Error updating display name:', error);
      toast({ title: 'Error', description: 'Could not update display name.', variant: 'destructive' });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword: SubmitHandler<PasswordFormValues> = async (data) => {
    if (!currentUser || !currentUser.email || !auth.currentUser) {
      toast({ title: 'Error', description: 'User not found, email missing, or session error. Please re-login.', variant: 'destructive' });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, data.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, data.newPassword);
      toast({ title: 'Success', description: 'Password changed successfully.' });
      passwordForm.reset();
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Could not change password.';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect current password.';
        passwordForm.setError('currentPassword', { type: 'manual', message: errorMessage });
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The new password is too weak.';
        passwordForm.setError('newPassword', { type: 'manual', message: errorMessage });
      }
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Please select a JPG, PNG, GIF, or WEBP image.", variant: "destructive" });
        setSelectedFile(null);
        event.target.value = ""; 
        return;
      }
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        toast({ title: "File Too Large", description: "Please select an image smaller than 1MB.", variant: "destructive" });
        setSelectedFile(null);
        event.target.value = ""; 
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile || !currentUser || !auth.currentUser) {
      toast({ title: "No File Selected or Session Error", description: "Please select an image file to upload and ensure you are logged in.", variant: "destructive" });
      return;
    }
    setIsUploadingPhoto(true);
    const storage = getStorage(); 
    const fileExtension = selectedFile.name.split('.').pop();
    const fileName = `profile_photo.${fileExtension}`;
    const imageRef = storageRef(storage, `profileImages/${currentUser.uid}/${fileName}`);

    try {
      await uploadBytes(imageRef, selectedFile);
      const downloadURL = await getDownloadURL(imageRef);

      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, { photoURL: downloadURL });

      setCurrentPhotoURL(downloadURL);
      setSelectedFile(null);
      const photoInput = document.getElementById('adminProfilePhotoInput') as HTMLInputElement | null;
      if (photoInput) photoInput.value = "";
      
      toast({ title: "Profile Photo Updated", description: "Your new profile photo has been uploaded." });
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      toast({ title: "Upload Failed", description: "Could not upload profile photo. Please try again.", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };


  if (authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-2">
        <User className="h-8 w-8 text-primary" /> My Profile
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your current account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-2 mb-3">
              <Avatar className="h-24 w-24">
                <AvatarImage src={currentPhotoURL || undefined} alt={currentDisplayName || "User"} data-ai-hint="user profile" className="object-cover" />
                <AvatarFallback>{getInitials(currentDisplayName, currentUser.email)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <p className="text-lg font-medium">{currentDisplayName || 'Not Set'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email Address</Label>
              <p className="text-sm">{currentUser.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="text-sm capitalize">{userRole || 'Unknown'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <p className="text-sm capitalize flex items-center">
                 <ShieldCheck className={`mr-1.5 h-4 w-4 ${userStatus === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                {userStatus || 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" /> Update Profile Photo
            </CardTitle>
            <CardDescription>Choose a new photo for your profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adminProfilePhotoInput">Choose Photo</Label>
              <Input
                id="adminProfilePhotoInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="mt-1"
                disabled={isUploadingPhoto}
              />
               <p className="text-xs text-muted-foreground mt-2">
                For best results, upload a square image with your face centered (e.g., 400x400px). Max file size: 1MB. JPG, PNG, GIF, WEBP accepted.
              </p>
            </div>
            <Button onClick={handleUploadPhoto} disabled={!selectedFile || isUploadingPhoto}>
              {isUploadingPhoto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUploadingPhoto ? "Uploading..." : "Upload Photo"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" /> Update Display Name
            </CardTitle>
            <CardDescription>Change how your name appears in the application.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={displayNameForm.handleSubmit(handleUpdateDisplayName)} className="space-y-4">
              <div>
                <Label htmlFor="adminDisplayName">New Display Name</Label>
                <Input
                  id="adminDisplayName"
                  {...displayNameForm.register('displayName')}
                  className={displayNameForm.formState.errors.displayName ? 'border-destructive' : ''}
                />
                {displayNameForm.formState.errors.displayName && (
                  <p className="text-sm text-destructive mt-1">
                    {displayNameForm.formState.errors.displayName.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isUpdatingName}>
                {isUpdatingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Name
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> Change Password
            </CardTitle>
            <CardDescription>Update your login password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <div>
                <Label htmlFor="adminCurrentPassword">Current Password</Label>
                <Input
                  id="adminCurrentPassword"
                  type="password"
                  {...passwordForm.register('currentPassword')}
                   className={passwordForm.formState.errors.currentPassword ? 'border-destructive' : ''}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive mt-1">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="adminNewPassword">New Password</Label>
                <Input
                  id="adminNewPassword"
                  type="password"
                  {...passwordForm.register('newPassword')}
                  className={passwordForm.formState.errors.newPassword ? 'border-destructive' : ''}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive mt-1">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="adminConfirmNewPassword">Confirm New Password</Label>
                <Input
                  id="adminConfirmNewPassword"
                  type="password"
                  {...passwordForm.register('confirmNewPassword')}
                  className={passwordForm.formState.errors.confirmNewPassword ? 'border-destructive' : ''}
                />
                {passwordForm.formState.errors.confirmNewPassword && (
                  <p className="text-sm text-destructive mt-1">
                    {passwordForm.formState.errors.confirmNewPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isUpdatingPassword}>
                {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
    

    