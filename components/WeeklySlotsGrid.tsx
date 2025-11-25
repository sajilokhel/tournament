"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  reconstructSlots,
  type ReconstructedSlot,
} from "@/lib/slotService";
import { 
  createBooking, 
  createPhysicalBooking, 
  unbookBooking 
} from "@/app/actions/bookings";
import { blockSlot, unblockSlot } from "@/app/actions/slots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Store } from "lucide-react";
import { BookingSummary } from "@/components/BookingSummary";
import { cn } from "@/lib/utils";

interface WeeklySlotsGridProps {
  groundId: string;
}

interface PhysicalBookingData {
  customerName: string;
  customerPhone: string;
  notes: string;
}

const WeeklySlotsGrid: React.FC<WeeklySlotsGridProps> = ({ groundId }) => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [slots, setSlots] = useState<ReconstructedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [venueDetails, setVenueDetails] = useState<any>(null);
  
  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ReconstructedSlot | null>(null);
  
  // Physical booking form
  const [physicalBookingData, setPhysicalBookingData] = useState<PhysicalBookingData>({
    customerName: "",
    customerPhone: "",
    notes: "",
  });
  
  // Block slot form
  const [blockReason, setBlockReason] = useState("");
  
  const [isManager, setIsManager] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  function getWeekEnd(weekStart: Date): Date {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDayLabel(date: Date): string {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const venueDoc = await getDoc(doc(db, "venues", groundId));
        if (venueDoc.exists()) {
          const venueData = venueDoc.data();
          setVenueDetails(venueData);
          
          if (user) {
            const userIsManager = venueData.managedBy === user.uid;
            setIsManager(userIsManager);
          }
        }
      } catch (error) {
        console.error("Error fetching venue data:", error);
      }
    }

    fetchData();
  }, [user, groundId]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const weekEnd = getWeekEnd(currentWeekStart);
      
      const reconstructedSlots = await reconstructSlots(
        groundId,
        currentWeekStart,
        weekEnd
      );
      
      setSlots(reconstructedSlots);
    } catch (error) {
      console.error("Error loading slots:", error);
      toast.error("Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, [groundId, currentWeekStart]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleUserBooking = async () => {
    if (!selectedSlot || !user) return;

    setIsProcessing(true);

    try {
      const venuePrice = venueDetails?.pricePerHour || 1000;
      const token = await user.getIdToken();

      const result = await createBooking(
        token,
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        selectedSlot.endTime,
        venuePrice
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // 3. Redirect to payment
      router.push(`/payment/${result.bookingId}`);

      toast.success("Slot reserved! Complete payment within 5 minutes.");
    } catch (error: any) {
      console.error("Error booking slot:", error);
      toast.error(error.message || "Failed to book slot");
    } finally {
      setIsProcessing(false);
      setBookingDialogOpen(false);
    }
  };

  const handlePhysicalReservation = (slot: ReconstructedSlot) => {
    setSelectedSlot(slot);
    setPhysicalBookingData({
      customerName: "",
      customerPhone: "",
      notes: "",
    });
    setBookingDialogOpen(true);
  };

  const handlePhysicalBookingSubmit = async () => {
    if (!selectedSlot || !user) return;

    if (!physicalBookingData.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setIsProcessing(true);

    try {
      const token = await user.getIdToken();
      
      const result = await createPhysicalBooking(
        token,
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        selectedSlot.endTime,
        physicalBookingData.customerName,
        physicalBookingData.customerPhone,
        physicalBookingData.notes
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Physical booking created successfully!");
      await loadSlots();
    } catch (error: any) {
      console.error("Error creating physical booking:", error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setIsProcessing(false);
      setBookingDialogOpen(false);
    }
  };

  const handleUnbookPhysical = async (slot: ReconstructedSlot) => {
    if (!isManager || slot.status !== "BOOKED" || slot.bookingType !== "physical") {
      return;
    }

    if (!confirm(`Unbook slot for ${slot.customerName}?`)) {
      return;
    }

    setIsProcessing(true);

    try {
      const token = await user.getIdToken();
      const result = await unbookBooking(token, groundId, slot.date, slot.startTime);
      
      if (!result.success) throw new Error(result.error);
      
      toast.success("Booking removed successfully");
      await loadSlots();
    } catch (error: any) {
      console.error("Error unbooking slot:", error);
      toast.error(error.message || "Failed to remove booking");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenBlockDialog = (slot: ReconstructedSlot) => {
    setSelectedSlot(slot);
    setBlockReason("");
    setBlockDialogOpen(true);
  };

  const handleBlockSlot = async () => {
    if (!selectedSlot || !user) return;

    setIsProcessing(true);

    try {
      const token = await user.getIdToken();
      const result = await blockSlot(
        token,
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        blockReason.trim() || undefined
      );
      
      if (!result.success) throw new Error(result.error);
      
      toast.success("Slot blocked successfully");
      await loadSlots();
      setBlockDialogOpen(false);
    } catch (error: any) {
      console.error("Error blocking slot:", error);
      toast.error(error.message || "Failed to block slot");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblockSlot = async (slot: ReconstructedSlot) => {
    if (!isManager || slot.status !== "BLOCKED") {
      return;
    }

    if (!confirm("Unblock this slot?")) {
      return;
    }

    setIsProcessing(true);

    try {
      const token = await user.getIdToken();
      const result = await unblockSlot(token, groundId, slot.date, slot.startTime);
      
      if (!result.success) throw new Error(result.error);

      toast.success("Slot unblocked successfully");
      await loadSlots();
    } catch (error: any) {
      console.error("Error unblocking slot:", error);
      toast.error(error.message || "Failed to unblock slot");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSlotClick = (slot: ReconstructedSlot) => {
    // User can't click held slots (except their own - they should go to payment)
    if (!isManager && slot.status === "HELD") {
      return;
    }

    // User booking
    if (!isManager && slot.status === "AVAILABLE") {
      setSelectedSlot(slot);
      setBookingDialogOpen(true);
      return;
    }

    // Manager unblock blocked slots
    if (isManager && slot.status === "BLOCKED") {
      handleUnblockSlot(slot);
      return;
    }

    // Manager unbook physical bookings
    if (isManager && slot.status === "BOOKED" && slot.bookingType === "physical") {
      handleUnbookPhysical(slot);
      return;
    }

    if (isManager && slot.status === "AVAILABLE") {
      handlePhysicalReservation(slot);
      return;
    }
  };

  const canClickSlot = (slot: ReconstructedSlot): boolean => {
    // Users can book available slots (but not held slots)
    if (!isManager && slot.status === "AVAILABLE") {
      return true;
    }

    // Managers can unblock blocked slots
    if (isManager && slot.status === "BLOCKED") {
      return true;
    }

    // Managers can unbook physical bookings
    if (isManager && slot.status === "BOOKED" && slot.bookingType === "physical") {
      return true;
    }

    // Managers can reserve available slots
    if (isManager && slot.status === "AVAILABLE") {
      return true;
    }

    return false;
  };

  const getSlotClassName = (slot: ReconstructedSlot): string => {
    const baseClasses = "relative h-14 rounded-lg border text-sm font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 overflow-hidden";
    
    const clickable = canClickSlot(slot);
    const hoverClasses = clickable
      ? "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      : "cursor-default opacity-80";

    switch (slot.status) {
      case "AVAILABLE":
        return cn(baseClasses, hoverClasses, "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300");
      
      case "BOOKED":
        if (slot.bookingType === "physical") {
          return cn(baseClasses, hoverClasses, "bg-purple-50 border-purple-200 text-purple-700");
        }
        return cn(baseClasses, "bg-amber-50 border-amber-200 text-amber-700");
      
      case "BLOCKED":
        return cn(baseClasses, hoverClasses, "bg-red-50 border-red-200 text-red-700");
      
      case "HELD":
        return cn(baseClasses, "bg-blue-50 border-blue-200 text-blue-700");
      
      case "RESERVED":
        return cn(baseClasses, "bg-gray-50 border-gray-200 text-gray-600");
      
      default:
        return baseClasses;
    }
  };

  const getSlotContent = (slot: ReconstructedSlot): React.ReactNode => {
    switch (slot.status) {
      case "AVAILABLE":
        return (
          <>
            <span>{slot.startTime}</span>
            <span className="text-[10px] font-normal opacity-80">Available</span>
          </>
        );
      
      case "BOOKED":
        return (
          <>
            <div className="flex items-center gap-1">
              {slot.bookingType === "physical" && <Store className="w-3 h-3" />}
              <span>{slot.startTime}</span>
            </div>
            <span className="text-[10px] font-normal opacity-80 truncate max-w-[90%]">
              {slot.customerName || "Booked"}
            </span>
          </>
        );
      
      case "BLOCKED":
        return (
          <>
            <span>{slot.startTime}</span>
            <span className="text-[10px] font-normal opacity-80">Blocked</span>
          </>
        );
      
      case "HELD":
        return (
          <>
            <span>{slot.startTime}</span>
            <span className="text-[10px] font-normal opacity-80">Held</span>
          </>
        );
      
      default:
        return <span>{slot.startTime}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group slots by date
  const slotsByDate = new Map<string, ReconstructedSlot[]>();
  slots.forEach((slot) => {
    if (!slotsByDate.has(slot.date)) {
      slotsByDate.set(slot.date, []);
    }
    slotsByDate.get(slot.date)!.push(slot);
  });

  // Generate week dates
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    weekDates.push(date);
  }

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-center bg-muted/30 p-2 rounded-lg">
        <div className="text-center">
          <div className="font-semibold">
            {currentWeekStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {" - "}
            {getWeekEnd(currentWeekStart).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs justify-center p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded flex items-center justify-center">
            <Store className="w-2 h-2 text-purple-800" />
          </div>
          <span>Physical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
          <span>Blocked</span>
        </div>
      </div>

      {/* Slots Grid - Scrollable on mobile */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[800px] grid grid-cols-7 gap-3">
          {weekDates.map((date) => {
            const dateString = formatDate(date);
            const dateSlots = slotsByDate.get(dateString) || [];
            const isToday = formatDate(new Date()) === dateString;

            return (
              <div key={dateString} className="space-y-3">
                <div className={cn(
                  "text-center p-2 rounded-lg border",
                  isToday ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                )}>
                  <div className="text-xs font-medium opacity-80">{date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-lg font-bold">{date.getDate()}</div>
                </div>
                
                <div className="space-y-2">
                  {dateSlots.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8 bg-muted/10 rounded-lg border border-dashed">
                      No slots
                    </div>
                  ) : (
                    dateSlots.map((slot) => (
                      <div key={`${slot.date}_${slot.startTime}`} className="relative group">
                        <div
                          className={getSlotClassName(slot)}
                          onClick={() => canClickSlot(slot) && handleSlotClick(slot)}
                        >
                          {getSlotContent(slot)}
                        </div>
                        {/* Manager block button on hover for available slots */}
                        {isManager && slot.status === "AVAILABLE" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBlockDialog(slot);
                            }}
                            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded shadow-sm z-10 hover:bg-destructive/90"
                            title="Block slot"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isManager ? "Create Physical Booking" : "Confirm Booking"}
            </DialogTitle>
            <DialogDescription>
              {isManager ? "Enter customer details for this slot." : "Review your booking details before proceeding to payment."}
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <div className="py-4">
              {isManager ? (
                <div className="space-y-4">
                  <div className="bg-muted/30 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium">
                      {formatDate(new Date(selectedSlot.date))} • {selectedSlot.startTime} - {selectedSlot.endTime}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <Input
                      id="customerName"
                      value={physicalBookingData.customerName}
                      onChange={(e) =>
                        setPhysicalBookingData({
                          ...physicalBookingData,
                          customerName: e.target.value,
                        })
                      }
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Customer Phone</Label>
                    <Input
                      id="customerPhone"
                      value={physicalBookingData.customerPhone}
                      onChange={(e) =>
                        setPhysicalBookingData({
                          ...physicalBookingData,
                          customerPhone: e.target.value,
                        })
                      }
                      placeholder="Enter customer phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={physicalBookingData.notes}
                      onChange={(e) =>
                        setPhysicalBookingData({
                          ...physicalBookingData,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Additional notes"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <BookingSummary
                  venueName={venueDetails?.name || "Futsal Ground"}
                  address={venueDetails?.address}
                  date={formatDate(new Date(selectedSlot.date))}
                  startTime={selectedSlot.startTime}
                  endTime={selectedSlot.endTime}
                  price={venueDetails?.pricePerHour || 1000}
                  className="border-0 shadow-none bg-muted/10"
                />
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBookingDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={isManager ? handlePhysicalBookingSubmit : handleUserBooking}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isManager ? "Create Booking" : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Slot Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Slot</DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <>
                  Block slot on {formatDate(new Date(selectedSlot.date))} at {selectedSlot.startTime}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason (Optional)</Label>
              <Textarea
                id="blockReason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Maintenance, Private event"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlockDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockSlot}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Block Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklySlotsGrid;
