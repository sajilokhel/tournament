"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { 
  applyActionCode, 
  confirmPasswordReset, 
  verifyPasswordResetCode 
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Key, MailCheck } from "lucide-react";

function AuthActionContent() {
  const params = useSearchParams();
  const router = useRouter();
  
  // URL Params
  const mode = params.get("mode"); // resetPassword, verifyEmail, recoverEmail
  const oobCode = params.get("oobCode");
  
  // State
  const [loading, setLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");
  
  // Password Reset State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 1. Verify the code immediately on load for Password Reset
  useEffect(() => {
    if (!oobCode) return;

    const verifyCode = async () => {
      if (mode === 'resetPassword') {
        try {
          const email = await verifyPasswordResetCode(auth, oobCode);
          setVerifiedEmail(email);
        } catch (error) {
          console.error(error);
          setStatus('error');
          setErrorMessage("This password reset link is invalid or has expired.");
        }
      }
    };

    verifyCode();
  }, [mode, oobCode]);

  // 2. Handle Email Verification
  const handleVerifyEmail = async () => {
    if (!oobCode) return;
    setLoading(true);
    try {
      await applyActionCode(auth, oobCode);
      setStatus('success');
      toast.success("Email verified successfully!");
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage("Failed to verify email. The link may be invalid.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Password Reset Submission
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus('success');
      toast.success("Password has been reset successfully!");
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!mode || !oobCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Invalid Link</h2>
            <p className="text-gray-500 mt-2">This link appears to be broken or missing required information.</p>
            <Button className="mt-4" onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success View
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Success!</h2>
            <p className="text-gray-500 mt-2">
              {mode === 'resetPassword' ? 'Your password has been updated.' : 'Your email has been verified.'}
            </p>
            <p className="text-sm text-gray-400 mt-4">Redirecting to login...</p>
            <Button className="mt-4 w-full" onClick={() => router.push('/auth/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error View
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Action Failed</h2>
            <p className="text-gray-500 mt-2">{errorMessage}</p>
            <Button className="mt-4 w-full" onClick={() => router.push('/auth/login')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verify Email UI
  if (mode === 'verifyEmail') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-2">
              <MailCheck className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Verify your Email</CardTitle>
            <CardDescription>Click the button below to confirm your email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={handleVerifyEmail} 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset Password UI
  if (mode === 'resetPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto bg-orange-100 p-3 rounded-full w-fit mb-2">
              <Key className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle className="text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              {verifiedEmail ? `for ${verifiedEmail}` : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}
