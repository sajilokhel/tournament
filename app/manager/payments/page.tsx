"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Receipt,
  Coins,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

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
  createdAt: string | null;
  refId?: string;
}

interface DuePaymentRecord {
  id: string;
  bookingId: string;
  venueId: string;
  venueName?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  managerId: string;
  amount: number;
  paymentMethod: "cash" | "online";
  bookingDate?: string;
  bookingStartTime?: string;
  bookingEndTime?: string;
  createdAt: string | null;
}

interface ManagerStats {
  totalBookings: number;
  physicalBookings: number;
  onlineBookings: number;
  totalIncome: number;      // Full face value of all confirmed bookings (display only)
  physicalIncome: number;  // Cash collected by manager from physical bookings
  onlineIncome: number;    // Advance actually collected by platform via eSewa
  safeOnlineIncome: number; // Online income past the cancellation window (safe to pay out)
  commissionPercentage: number; // Platform commission % for this venue
  commissionAmount: number; // Total platform commission amount
  netIncome: number; // Online income after platform commission
}

export default function ManagerPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [duePayments, setDuePayments] = useState<DuePaymentRecord[]>([]);
  const [duePaymentsLoading, setDuePaymentsLoading] = useState(true);
  const [dueSearchTerm, setDueSearchTerm] = useState("");
  
  const [managerData, setManagerData] = useState<any>(null);
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

  const fetchFinancials = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/managers/${user.uid}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load stats");
      }
      const data = await res.json();
      setManagerData({ totalPaidOut: data.derived.totalPaidOut });
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching financials:", error);
    }
  };

  const fetchPayments = async () => {
    if (!user) return;
    setLoading(true);
    setDuePaymentsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/manager/payments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load payments");
      }
      const data = await res.json();
      setPayments(data.payments ?? []);
      setDuePayments(data.duePayments ?? []);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
      setDuePaymentsLoading(false);
    }
  };

  const fetchDuePayments = async () => {
    // No-op: handled by fetchPayments (single API call for both)
  };

  useEffect(() => {
    fetchPayments();
    fetchFinancials();
    fetchDuePayments();
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
  // physicalIncome: cash manager collected directly from walk-in bookings
  // heldByManager: physical cash + whatever platform already paid out to them
  // heldByAdmin: online advance collected by platform not yet paid out
  const heldByManager = stats.physicalIncome + totalPaidOut;
  const heldByAdmin = stats.onlineIncome - totalPaidOut;
  const totalToBePaid = heldByAdmin;
  const actualPaymentToBePaid = stats.safeOnlineIncome - totalPaidOut;

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 pt-14 lg:pt-6">
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Held by Admin
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Online advances collected via eSewa not yet paid out to you. = eSewa collected − Total Paid Out.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold">
                Rs. {heldByAdmin.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Online Income - Paid Out
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
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
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold text-orange-600">
                Rs. {totalToBePaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending Clearance + Safe
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
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
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold text-primary">
                Rs. {actualPaymentToBePaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Safe to Pay Now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Held by Me
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your physical booking cash collections plus amounts already paid out to you by the platform.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold">
                Rs. {heldByManager.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Physical + Paid Out
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commission Card */}
        {stats.commissionPercentage > 0 && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Commission Deducted
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Platform commission ({stats.commissionPercentage}%) deducted from total income.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold text-red-600">
                Rs. {stats.commissionAmount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.commissionPercentage}% of Rs. {stats.totalIncome.toLocaleString()}
              </p>
              <p className="text-xs text-orange-600 mt-2 font-medium">
                Net Income: Rs. {stats.netIncome.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Transaction Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total Revenue
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Full face value of all confirmed bookings across your venues (online + physical). Online bookings show their full slot price, but only the advance was collected via eSewa.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold">
                Rs. {stats.totalIncome.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                All Bookings (Online + Physical)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium">Failed/Pending</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl font-bold">
                {
                  filteredPayments.filter((p) => p.status !== "success").length
                }
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Due Amount Payments Section */}
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              <div>
                <CardTitle className="text-orange-700 dark:text-orange-400">Due Amount Payments</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Payments collected from customers for booking due amounts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Collected</p>
                <p className="text-xl font-bold text-orange-600">
                  Rs. {duePayments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8"
                  value={dueSearchTerm}
                  onChange={(e) => setDueSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {duePaymentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading due payments...</div>
          ) : duePayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Coins className="h-10 w-10 mb-3 opacity-20" />
              <p>No due payments recorded yet.</p>
              <p className="text-xs mt-1">Payments will appear here when you mark a booking due as paid.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-4 p-4">
                {duePayments
                  .filter((p) => {
                    if (!dueSearchTerm.trim()) return true;
                    const t = dueSearchTerm.toLowerCase();
                    return (
                      (p.userName?.toLowerCase() || "").includes(t) ||
                      (p.userEmail?.toLowerCase() || "").includes(t) ||
                      (p.venueName?.toLowerCase() || "").includes(t) ||
                      (p.bookingId?.toLowerCase() || "").includes(t)
                    );
                  })
                  .map((p) => (
                    <div key={p.id} className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 space-y-3 border border-orange-100 dark:border-orange-900">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{p.userName || p.userEmail || "Walk-in"}</span>
                          <span className="text-xs text-muted-foreground">{p.venueName || "Unknown Venue"}</span>
                        </div>
                        <Badge variant="outline" className={p.paymentMethod === "cash" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                          {p.paymentMethod === "cash" ? "Cash" : "Online"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Date Paid</span>
                          <span>{p.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "N/A"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Booking</span>
                          <span>{p.bookingDate} {p.bookingStartTime && `${p.bookingStartTime}–${p.bookingEndTime}`}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-orange-100">
                        <span className="text-xs font-mono text-muted-foreground">{p.bookingId?.slice(-8)}</span>
                        <span className="font-bold text-orange-600">Rs. {(p.amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Paid</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duePayments
                      .filter((p) => {
                        if (!dueSearchTerm.trim()) return true;
                        const t = dueSearchTerm.toLowerCase();
                        return (
                          (p.userName?.toLowerCase() || "").includes(t) ||
                          (p.userEmail?.toLowerCase() || "").includes(t) ||
                          (p.venueName?.toLowerCase() || "").includes(t) ||
                          (p.bookingId?.toLowerCase() || "").includes(t)
                        );
                      })
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {p.createdAt
                              ? format(new Date(p.createdAt), "MMM d, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{p.userName || "Walk-in"}</span>
                              {p.userEmail && (
                                <span className="text-xs text-muted-foreground">{p.userEmail}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{p.venueName || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span>{p.bookingDate}</span>
                              {p.bookingStartTime && (
                                <span className="text-muted-foreground">{p.bookingStartTime} – {p.bookingEndTime}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={p.paymentMethod === "cash" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                              {p.paymentMethod === "cash" ? "Cash" : "Online"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-orange-600">
                            Rs. {(p.amount || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No payments found.</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-4 p-4">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{payment.userEmail || "Unknown User"}</span>
                        <span className="text-xs text-muted-foreground">{payment.venueName || "Unknown Venue"}</span>
                      </div>
                      <Badge
                        variant={
                          payment.status === "success"
                            ? "default"
                            : payment.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                        className="capitalize text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex flex-col text-muted-foreground">
                        <span className="text-xs uppercase tracking-wider">Date</span>
                        <span className="text-gray-900">
                          {payment.createdAt
                            ? format(new Date(payment.createdAt), "MMM d, yyyy")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col text-muted-foreground">
                        <span className="text-xs uppercase tracking-wider">Amount</span>
                        <span className="text-gray-900 font-bold">NPR {payment.amount?.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground capitalize">{payment.method}</span>
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {payment.refId ? `#${payment.refId.slice(-6)}` : "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
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
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {payment.createdAt
                            ? format(
                                new Date(payment.createdAt),
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
