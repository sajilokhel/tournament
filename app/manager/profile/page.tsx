"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, User, Mail, Shield, Lock, Key, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ManagerProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetEmailLoading, setResetEmailLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to view this page.</p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/login/manager">
              <Button>Manager Login</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isGoogleAuth = user.providerData.some(p => p.providerId === 'google.com');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pt-14 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manager Profile</h1>
        <p className="text-gray-500">Manage your account settings and security</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Profile Summary Card */}
        <Card className="md:col-span-1 h-fit">
          <CardContent className="pt-6 text-center space-y-4">
            <Avatar className="h-24 w-24 mx-auto border-4 border-orange-50">
              <AvatarImage src={user.photoURL || ""} />
              <AvatarFallback className="text-3xl bg-orange-100 text-orange-700">
                {user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{userData?.displayName || user.displayName || "Manager"}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <div className="pt-4 border-t text-left space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Role</span>
                <span className="font-medium capitalize bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
                  {userData?.role || "Manager"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Joined</span>
                <span className="font-medium">
                  {userData?.createdAt?.toDate().toLocaleDateString() || "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Email Address</Label>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-md border text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Display Name</Label>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-md border text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{userData?.displayName || user.displayName || "Not set"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Settings</CardTitle>
              <CardDescription>Update your password and security preferences</CardDescription>
            </CardHeader>
            <CardContent>
              {isGoogleAuth ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-full shadow-sm">
                      <Shield className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-900">Google Account Authentication</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        You are logged in using your Google account. Your password and security settings are managed by Google.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current">Current Password</Label>
                    <Input 
                      id="current" 
                      type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="new">New Password</Label>
                      <Input 
                        id="new" 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirm">Confirm Password</Label>
                      <Input 
                        id="confirm" 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled={resetEmailLoading}
                      onClick={handleForgotPassword}
                    >
                      {resetEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Forgot Password?
                    </Button>
                    <Button type="submit" disabled={passwordLoading}>
                      {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
