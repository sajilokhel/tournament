"use client";

import React, { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  CreditCard,
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Info,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaymentRecord {
  id: string;
  transactionUuid: string;
  bookingId: string;
  userId: string;
  userEmail?: string;
  venueId: string;
  venueName?: string;
  managerId?: string;
  amount: number;
  status: "success" | "failure" | "pending" | "refunded";
  method: string;
  createdAt: Timestamp;
  refId?: string;
}

interface ManagerStats {
  totalBookings: number;
  physicalBookings: number;
  onlineBookings: number;
  totalIncome: number; // Total value of all bookings
  onlineIncome: number; // Income collected by us (eSewa)
  safeOnlineIncome: number; // Online income that is safe to pay (past cancellation window)
}

export default function ManagerPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [managerData, setManagerData] = useState<any>(null);
  const [stats, setStats] = useState<ManagerStats>({
    totalBookings: 0,
    physicalBookings: 0,
    onlineBookings: 0,
    totalIncome: 0,
    onlineIncome: 0,
    safeOnlineIncome: 0,
  });

  const fetchFinancials = async () => {
    if (!user) return;
    try {
      // 1. Fetch Manager Details (for totalPaidOut and cancellation limit)
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setManagerData(userDoc.data());
      }
      
      const limitHours = userDoc.exists() ? (userDoc.data().cancellationHoursLimit || 5) : 5;

      // 2. Fetch Venues managed by this user
      const venuesQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid)
      );
      const venuesSnap = await getDocs(venuesQuery);
      const venueIds = venuesSnap.docs.map((d) => d.id);

      if (venueIds.length === 0) return;

      // 3. Fetch Bookings for these venues
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

          // Check if safe to pay
          const bookingDateStr = b.date;
          const bookingTimeStr = b.startTime;
          const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);

          const diffMs = bookingDateTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours < limitHours) {
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
      console.error("Error fetching financials:", error);
    }
  };

  const fetchPayments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Query payments where managerId matches current user
      const q = query(
        collection(db, "payments"),
        where("managerId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as PaymentRecord[];
      setPayments(list);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchFinancials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        (p.userEmail?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (p.venueName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (p.transactionUuid?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (p.refId?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  const totalRevenue = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === "success")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filteredPayments]);

  // Derived calculations
  const totalPaidOut = managerData?.totalPaidOut || 0;
  const physicalIncome = stats.totalIncome - stats.onlineIncome;
  const heldByManager = physicalIncome + totalPaidOut;
  const heldByAdmin = stats.onlineIncome - totalPaidOut;
  const totalToBePaid = heldByAdmin;
  const actualPaymentToBePaid = stats.safeOnlineIncome - totalPaidOut;

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Venue Payments</h1>
            <p className="text-muted-foreground">
              Financial overview and transaction history
            </p>
          </div>
          <Button variant="outline" onClick={() => { fetchPayments(); fetchFinancials(); }}>
            Refresh
          </Button>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Held by Admin</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {heldByAdmin.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Online Income - Paid Out
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total To Be Paid
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total Online Income held by Admin that needs to be paid eventually.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                Rs. {totalToBePaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending Clearance + Safe
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Actual To Be Paid
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Safe Online Income (past cancellation window) minus Paid Out.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                Rs. {actualPaymentToBePaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Safe to Pay Now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Held by Me</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {heldByManager.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Physical + Paid Out
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {stats.totalIncome.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                All Bookings (Online + Physical)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredPayments.length > 0
                  ? Math.round(
                      (filteredPayments.filter((p) => p.status === "success")
                        .length /
                        filteredPayments.length) *
                        100
                    )
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed/Pending</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  filteredPayments.filter((p) => p.status !== "success").length
                }
              </div>
            </CardContent>
          </Card>
        </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search user, venue, or ID..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ref ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No payments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {payment.createdAt?.seconds
                        ? format(
                            new Date(payment.createdAt.seconds * 1000),
                            "MMM d, yyyy HH:mm"
                          )
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {payment.userEmail || "Unknown User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {payment.userId.slice(0, 8)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {payment.venueName || "Unknown Venue"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      NPR {payment.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {payment.method}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "success"
                            ? "default"
                            : payment.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                        className="capitalize"
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {payment.refId || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
