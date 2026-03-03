"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { DEFAULT_CANCELLATION_HOURS } from "@/lib/utils";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  addDoc,
  serverTimestamp,
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
  totalIncome: number; // Total value of all bookings
  onlineIncome: number; // Income collected by us (eSewa)
  safeOnlineIncome: number; // Online income that is safe to pay (past cancellation window)
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
    onlineIncome: 0,
    safeOnlineIncome: 0,
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
        
        // Set cancellation limit from user data or default
        const limit = userData.cancellationHoursLimit !== undefined ? userData.cancellationHoursLimit : DEFAULT_CANCELLATION_HOURS;
        setCancellationLimit(limit);

        // 2. Fetch Venues managed by this user
        const venuesQuery = query(
          collection(db, "venues"),
          where("managedBy", "==", id)
        );
        const venuesSnap = await getDocs(venuesQuery);
        const venueIds = venuesSnap.docs.map((d) => d.id);

        if (venueIds.length === 0) {
          setLoading(false);
          return;
        }

        // 3. Fetch Bookings for these venues
        // Note: Firestore 'in' query is limited to 10. If a manager has > 10 venues, this needs batching.
        // For now assuming < 10 venues per manager.
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("venueId", "in", venueIds)
        );
        const bookingsSnap = await getDocs(bookingsQuery);

        let totalBookings = 0;
        let physicalBookings = 0;
        let onlineBookings = 0;
        let totalIncome = 0;
        let onlineIncome = 0;
        let safeOnlineIncome = 0;

        const now = new Date();

        bookingsSnap.forEach((doc) => {
          const b = doc.data();
          // Only count confirmed/completed bookings
          if (b.status !== "confirmed" && b.status !== "completed") return;

          totalBookings++;
          const amount = Number(b.amount || b.price || 0);
          totalIncome += amount;

          const method = (b.bookingType || "").toLowerCase();
          const isOnline = method === "website" || method === "app";

          if (isOnline) {
            onlineBookings++;
            onlineIncome += amount;

            // Check if safe to pay (booking time is within X hours from now or in the past)
            // Booking time construction:
            const bookingDateStr = b.date; // "YYYY-MM-DD"
            const bookingTimeStr = b.startTime; // "HH:mm"
            const bookingDateTime = new Date(
              `${bookingDateStr}T${bookingTimeStr}`
            );

            // Calculate hours difference
            const diffMs = bookingDateTime.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // If diffHours < limit, it means booking is either in past or within next X hours.
            // User cannot cancel, so it's safe.
            if (diffHours < limit) {
              safeOnlineIncome += amount;
            }
          } else {
            physicalBookings++;
          }
        });

        setStats({
          totalBookings,
          physicalBookings,
          onlineBookings,
          totalIncome,
          onlineIncome,
          safeOnlineIncome,
        });
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
      await updateDoc(doc(db, "users", id as string), {
        cancellationHoursLimit: cancellationLimit,
      });
      toast.success("Cancellation limit updated");
      setIsLimitDialogOpen(false);
      // Refresh data to recalculate safe income
      window.location.reload(); 
    } catch (error) {
      console.error("Error updating limit:", error);
      toast.error("Failed to update limit");
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
      const newPaidOut = currentPaidOut + amount;

      // 1. Update Manager's totalPaidOut
      await updateDoc(doc(db, "users", id as string), {
        totalPaidOut: newPaidOut,
      });

      // 2. Create Payout Record
      await addDoc(collection(db, "payouts"), {
        managerId: id,
        amount: amount,
        date: serverTimestamp(),
        transactionId: transactionId,
        notes: payoutNotes,
        adminId: currentUser?.uid || "unknown",
        adminEmail: currentUser?.email || "unknown",
      });

      setManager((prev: any) => ({ ...prev, totalPaidOut: newPaidOut }));
      toast.success("Payout recorded successfully");
      setIsPayoutDialogOpen(false);
      setPayoutAmount("");
      setPayoutNotes("");
      setTransactionId("");
    } catch (error) {
      console.error("Error recording payout:", error);
      toast.error("Failed to record payout");
    } finally {
      setProcessingPayout(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!manager) return null;

  const totalPaidOut = manager.totalPaidOut || 0;
  
  // Derived calculations based on user request
  const physicalIncome = stats.totalIncome - stats.onlineIncome;
  const heldByManager = physicalIncome + totalPaidOut;
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
              <CardTitle className="text-sm font-medium">All Income</CardTitle>
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
              <CardTitle className="text-sm font-medium">Held by Manager</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {heldByManager.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Physical ({physicalIncome.toLocaleString()}) + Paid Out ({totalPaidOut.toLocaleString()})
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
      </div>
    </TooltipProvider>
  );
}
