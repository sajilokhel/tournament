"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  Users,
  CreditCard,
  Banknote,
  AlertCircle,
  Info,
  TrendingUp,
  Wallet,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ManagerStats {
  totalBookings: number;
  physicalBookings: number;
  onlineBookings: number;
  totalIncome: number;      // Full face value of all confirmed bookings (display only)
  physicalIncome: number;  // Cash collected by manager from physical bookings
  onlineIncome: number;    // Advance actually collected by platform via eSewa
  safeOnlineIncome: number; // Online income past the cancellation window (safe to pay out)
  commissionPercentage: number;
  commissionAmount: number;
  netIncome: number;
}

export default function ManagerDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [manager, setManager] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ManagerStats>({
    totalBookings: 0,
    physicalBookings: 0,
    onlineBookings: 0,
    totalIncome: 0,
    physicalIncome: 0,
    onlineIncome: 0,
    safeOnlineIncome: 0,
    commissionPercentage: 0,
    commissionAmount: 0,
    netIncome: 0,
  });
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [cancellationLimit, setCancellationLimit] = useState(5);
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // 1. Fetch Manager Details
        const userDoc = await getDoc(doc(db, "users", id as string));
        if (!userDoc.exists()) {
          toast.error("Manager not found");
          router.push("/admin/managers");
          return;
        }
        const userData = userDoc.data();
        setManager({ id: userDoc.id, ...userData });
        
        // 2. Fetch stats from API (server-side calculation)
        const token = await currentUser?.getIdToken();
        const res = await fetch(`/api/managers/${id}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load stats");
        }
        const data = await res.json();
        setStats(data.stats);
        setCancellationLimit(data.cancellationLimit);
      } catch (error) {
        console.error("Error fetching manager details:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]); // Removed cancellationLimit from dependency to avoid loop, logic is inside

  const handleUpdateLimit = async () => {
    try {
      const token = await currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`/api/admin/managers/${id}/limit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours: cancellationLimit }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to update limit");
      }

      toast.success("Cancellation limit updated");
      setIsLimitDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating limit:", error);
      toast.error(error.message || "Failed to update limit");
    }
  };

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const currentPaidOut = manager.totalPaidOut || 0;
    const actualPaymentToBePaid = stats.safeOnlineIncome - currentPaidOut;

    if (amount > actualPaymentToBePaid) {
      toast.error(`Cannot pay more than safe amount: Rs. ${actualPaymentToBePaid.toLocaleString()}`);
      return;
    }

    setProcessingPayout(true);
    try {
      const token = await currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`/api/admin/managers/${id}/payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          transactionId,
          notes: payoutNotes,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to record payout");
      }

      const data = await res.json();
      setManager((prev: any) => ({ ...prev, totalPaidOut: data.newPaidOut }));
      toast.success("Payout recorded successfully");
      setIsPayoutDialogOpen(false);
      setPayoutAmount("");
      setPayoutNotes("");
      setTransactionId("");
    } catch (error: any) {
      console.error("Error recording payout:", error);
      toast.error(error.message || "Failed to record payout");
    } finally {
      setProcessingPayout(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!manager) return null;

  const totalPaidOut = manager.totalPaidOut || 0;
  
  // Derived calculations
  // physicalIncome: cash the manager collected directly from walk-in bookings
  // heldByManager: physical cash + whatever the platform already paid out to them
  // heldByAdmin: online advance collected by platform that hasn't been paid out yet
  const heldByManager = stats.physicalIncome + totalPaidOut;
  const heldByAdmin = stats.onlineIncome - totalPaidOut;
  const totalToBePaid = heldByAdmin; // All online income not yet paid out
  const actualPaymentToBePaid = stats.safeOnlineIncome - totalPaidOut; // Safe online income not yet paid out

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/admin/managers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {manager.displayName || "Manager Details"}
            </h1>
            <p className="text-muted-foreground">{manager.email}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                All Income
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Face value of all confirmed bookings (online + physical). Online bookings only charged the advance (~16.6%) via eSewa; the rest is paid physically at the venue.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {stats.totalIncome.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total Revenue Generated
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Held by Manager
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cash the manager directly collected from physical bookings, plus amounts the platform has already paid out to them.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {heldByManager.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Physical ({stats.physicalIncome.toLocaleString()}) + Paid Out ({totalPaidOut.toLocaleString()})
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Held by Admin
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Online Income ({stats.onlineIncome.toLocaleString()}) - Paid Out ({totalPaidOut.toLocaleString()})</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {heldByAdmin.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently in Admin Account
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Payout Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Total To Be Paid
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total Online Income held by Admin that needs to be paid eventually.</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div className="text-2xl font-bold text-orange-600">
                  Rs. {totalToBePaid.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Held by Admin
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Actual Payment To Be Paid
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Safe Online Income (past cancellation window) minus Paid Out.</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div className="text-2xl font-bold text-primary">
                  Rs. {actualPaymentToBePaid.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Safe to Pay Now
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  In Manager Account
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total amount already transferred to manager.</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div className="text-2xl font-bold text-blue-600">
                  Rs. {totalPaidOut.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Paid Out
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Only pay amounts that are "Net Payable Now". Users cannot cancel
                  bookings within {cancellationLimit} hours of start time.
                </span>
                <Dialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" className="h-auto p-0 text-xs">
                      (Edit Limit)
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Cancellation Limit</DialogTitle>
                      <DialogDescription>
                        Set the number of hours before booking start time when cancellation is disabled.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="limit" className="text-right text-sm">
                          Hours
                        </label>
                        <Input
                          id="limit"
                          type="number"
                          value={cancellationLimit}
                          onChange={(e) => setCancellationLimit(Number(e.target.value))}
                          className="col-span-3"
                          min="0"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateLimit}>Save Limit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Dialog
                open={isPayoutDialogOpen}
                onOpenChange={setIsPayoutDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>Record Payout</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payout to Manager</DialogTitle>
                    <DialogDescription>
                      Enter the amount you have manually transferred to the manager.
                      This will update their balance.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="amount" className="text-right text-sm">
                        Amount
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        className="col-span-3"
                        placeholder={`Max: ${actualPaymentToBePaid}`}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="txnId" className="text-right text-sm">
                        Txn ID
                      </label>
                      <Input
                        id="txnId"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="col-span-3"
                        placeholder="Bank/Wallet Transaction ID"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                      <label htmlFor="notes" className="text-right text-sm pt-2">
                        Notes
                      </label>
                      <Textarea
                        id="notes"
                        value={payoutNotes}
                        onChange={(e) => setPayoutNotes(e.target.value)}
                        className="col-span-3"
                        placeholder="Additional details..."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      Safe to Pay: Rs. {actualPaymentToBePaid.toLocaleString()}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPayoutDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handlePayout} disabled={processingPayout}>
                      {processingPayout ? "Recording..." : "Confirm Payout"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Booking Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Booking Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y">
            {/* Physical Bookings Row */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-2">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Physical Bookings</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.physicalBookings} booking{stats.physicalBookings !== 1 ? "s" : ""} · Cash collected by manager
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">Rs. {stats.physicalIncome.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Paid to manager directly</p>
              </div>
            </div>

            {/* Online Bookings Row */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Online Bookings (eSewa)</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.onlineBookings} booking{stats.onlineBookings !== 1 ? "s" : ""} · Advance collected via eSewa
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">Rs. {stats.onlineIncome.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Held by admin</p>
              </div>
            </div>

            {/* Commission Row — only shown when > 0 */}
            {stats.commissionAmount > 0 && (
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Platform Commission</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.commissionPercentage}% of online income
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">− Rs. {stats.commissionAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Deducted from online income</p>
                </div>
              </div>
            )}

            {/* Net Payable Row */}
            <div className="flex items-center justify-between py-4 bg-primary/5 rounded-lg px-3 mt-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">We Will Pay You</p>
                  <p className="text-xs text-muted-foreground">
                    Safe online income{stats.commissionAmount > 0 ? " after commission" : ""} · minus already paid out
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-green-600">Rs. {actualPaymentToBePaid.toLocaleString()}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <p className="text-xs text-green-600 font-medium">Safe to pay now</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
