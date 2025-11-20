"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
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
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

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
        setManager({ id: userDoc.id, ...userDoc.data() });

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

          const isOnline =
            b.paymentMethod === "esewa" || b.paymentMethod === "khalti"; // Add other online methods if any

          if (isOnline) {
            onlineBookings++;
            onlineIncome += amount;

            // Check if safe to pay (booking time is within 5 hours from now or in the past)
            // Booking time construction:
            const bookingDateStr = b.date; // "YYYY-MM-DD"
            const bookingTimeStr = b.startTime; // "HH:mm"
            const bookingDateTime = new Date(
              `${bookingDateStr}T${bookingTimeStr}`
            );

            // Calculate hours difference
            const diffMs = bookingDateTime.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // If diffHours < 5, it means booking is either in past or within next 5 hours.
            // User cannot cancel, so it's safe.
            if (diffHours < 5) {
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
  }, [id, router]);

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setProcessingPayout(true);
    try {
      const currentPaidOut = manager.totalPaidOut || 0;
      const newPaidOut = currentPaidOut + amount;

      await updateDoc(doc(db, "users", id as string), {
        totalPaidOut: newPaidOut,
      });

      setManager((prev: any) => ({ ...prev, totalPaidOut: newPaidOut }));
      toast.success("Payout recorded successfully");
      setIsPayoutDialogOpen(false);
      setPayoutAmount("");
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
  const toBePaid = stats.safeOnlineIncome - totalPaidOut;

  return (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Bookings
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Physical vs Online
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.physicalBookings} / {stats.onlineBookings}
            </div>
            <p className="text-xs text-muted-foreground">
              Physical / Online
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {stats.totalIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Gross revenue generated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Online Income (Held)
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {stats.onlineIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Collected via eSewa
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                Safe to Pay (Cleared)
              </span>
              <div className="text-2xl font-bold text-green-600">
                Rs. {stats.safeOnlineIncome.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Bookings within 5h or past
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                Total Paid Out
              </span>
              <div className="text-2xl font-bold text-blue-600">
                Rs. {totalPaidOut.toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                To Be Paid (Balance)
              </span>
              <div className="text-2xl font-bold text-primary">
                Rs. {toBePaid.toLocaleString()}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                Only pay amounts that are "Safe to Pay". Users cannot cancel
                bookings within 5 hours of start time.
              </span>
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
                      placeholder="e.g. 5000"
                    />
                  </div>
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
  );
}
