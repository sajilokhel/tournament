"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, updatePassword, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, User, Mail, Calendar, Shield, Lock, Key } from "lucide-react";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetEmailLoading, setResetEmailLoading] = useState(false);

  // Account Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setDisplayName(data.displayName || user.displayName || "");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load profile data");
        } finally {
          setLoading(false);
        }
      } else if (!authLoading) {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, authLoading]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/wrong-password') {
        toast.error("Incorrect current password");
      } else {
        toast.error("Failed to update password. Please try again.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user || !user.email) return;
    
    setResetEmailLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, user.email, actionCodeSettings);
      toast.success("Password reset email sent. Please check your inbox.");
    } catch (error) {
      console.error("Error sending password reset email:", error);
      toast.error("Failed to send password reset email.");
    } finally {
      setResetEmailLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!user.providerData.some(p => p.providerId === 'google.com') && !deletePassword) {
      toast.error("Please enter your password to confirm deletion");
      return;
    }

    setDeleteLoading(true);
    try {
      // Re-authenticate if password provider
      if (!user.providerData.some(p => p.providerId === 'google.com')) {
        if (!user.email) throw new Error("User email not found");
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        // Re-authenticate for Google provider to avoid requires-recent-login
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      // Log the reason (Optional: save to an audit collection or use it in a cloud function context)
      // Since the user is being deleted, we'd typically save this in a separate 'deleted_users_feedback' collection.
      // E.g., await addDoc(collection(db, "deleted_users_feedback"), { email: user.email, reason: deleteReason, deletedAt: new Date() });
      console.log("Account deleted for reason:", deleteReason);

      // 1. Delete user document from Firestore
      await deleteDoc(doc(db, "users", user.uid));
      
      // 2. Delete user from Firebase Auth
      await deleteUser(user);
      
      toast.success("Account deleted successfully");
      // Note: AuthContext will handle the auth state change and redirection
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/wrong-password') {
        toast.error("Incorrect password");
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error("Please log out and log back in before deleting your account for security purposes.");
      } else {
        toast.error("Failed to delete account. Please try again or contact support.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen pt-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-8">
          <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
            <AvatarImage src={user.photoURL || ""} alt={displayName} />
            <AvatarFallback className="text-2xl bg-orange-100 text-orange-700">
              {displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{displayName || "User"}</h1>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      id="email" 
                      value={user.email || ""} 
                      disabled 
                      className="pl-9 bg-gray-50" 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      id="displayName" 
                      value={displayName} 
                      disabled
                      className="pl-9 bg-gray-50" 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Display name cannot be changed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>Your account status and information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Account Role</p>
                      <p className="text-xs text-gray-500 capitalize">{userData?.role || "User"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Member Since</p>
                      <p className="text-xs text-gray-500">
                        {userData?.createdAt?.toDate().toLocaleDateString() || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password Section */}
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your password and security settings</CardDescription>
              </CardHeader>
              <CardContent>
                {user.providerData.some(p => p.providerId === 'google.com') ? (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                    <Shield className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Google Account Login</p>
                      <p className="text-sm mt-1">
                        You have logged in with Google. You don't need a password for this account.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          id="currentPassword" 
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="pl-9" 
                          placeholder="Enter current password"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          id="newPassword" 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-9" 
                          placeholder="Enter new password"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          id="confirmPassword" 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-9" 
                          placeholder="Confirm new password"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={passwordLoading} className="w-full">
                      {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Change Password
                    </Button>
                    
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled={resetEmailLoading} 
                      className="w-full"
                      onClick={handleForgotPassword}
                    >
                      {resetEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Password Reset Email
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Danger Zone - Full width below the grid */}
        <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-red-600 relative flex items-center gap-2">Danger Zone</CardTitle>
                <CardDescription>Permanently delete your account and all related data</CardDescription>
              </CardHeader>
              <CardContent>
                {showDeleteConfirm ? (
                  <form onSubmit={handleDeleteAccount} className="space-y-4">
                    <p className="text-sm font-medium text-red-600 mb-2">
                      Warning: This action cannot be undone. All your bookings, venues, and profile data will be permanently removed.
                    </p>
                    
                    {!user.providerData.some(p => p.providerId === 'google.com') && (
                      <div className="space-y-2">
                        <Label htmlFor="deletePassword">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="deletePassword" 
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            className="pl-9 bg-white" 
                            placeholder="Enter password to confirm"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="deleteReason">Reason for leaving (Optional)</Label>
                      <textarea
                        id="deleteReason"
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Why are you deleting your account? Let us know how we can improve."
                      />
                    </div>
                    
                    <div className="flex gap-3 mt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword("");
                          setDeleteReason("");
                        }}
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-100 bg-white"
                        disabled={deleteLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        variant="destructive" 
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        disabled={deleteLoading}
                      >
                        {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Deletion
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">Once deleted, your account cannot be recovered.</p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
      </div>
    </div>
  );
}
