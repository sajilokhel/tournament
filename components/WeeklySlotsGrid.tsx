/**
 * WeeklySlotsGrid - Refactored to use slotService
 * 
 * This component displays a weekly view of slots using the new
 * venue-based slot architecture. Slots are reconstructed on-demand
 * from venue configuration + exceptions.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  reconstructSlots,
  bookSlot,
  unbookSlot,
  holdSlot,
  releaseHold,
  reserveSlot,
  unreserveSlot,
  blockSlot,
  unblockSlot,
  type ReconstructedSlot,
} from "@/lib/slotService";
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
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    getWeekStart(new Date())
  );
  
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

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  function getWeekEnd(weekStart: Date): Date {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }

  function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  function getDayLabel(date: Date): string {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // ============================================================================
  // Check Manager Access
  // ============================================================================

  useEffect(() => {
    async function checkManagerAccess() {
      if (!user) {
        setIsManager(false);
        return;
      }

      try {
        const venueDoc = await getDoc(doc(db, "venues", groundId));
        if (venueDoc.exists()) {
          const venueData = venueDoc.data();
          const userIsManager = venueData.managedBy === user.uid;
          setIsManager(userIsManager);
        }
      } catch (error) {
        console.error("Error checking manager access:", error);
      }
    }

    checkManagerAccess();
  }, [user, groundId]);

  // ============================================================================
  // Load Slots
  // ============================================================================

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

  // ============================================================================
  // Week Navigation
  // ============================================================================

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  // ============================================================================
  // Slot Interaction Handlers
  // ============================================================================

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

    // Manager reserve slot (right-click or long-press for block?)
    // For now, clicking available = book, we'll add a button for block
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

  // ============================================================================
  // User Booking Flow
  // ============================================================================

  const handleUserBooking = async () => {
    if (!selectedSlot || !user) return;

    setIsProcessing(true);

    try {
      // 1. Hold the slot
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await holdSlot(
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        user.uid,
        bookingId,
        5 // 5 minutes hold
      );

      // Calculate hold expiry (5 minutes from now)
      const now = Date.now();
      const holdExpiresAt = new Date(now + 5 * 60 * 1000); // 5 minutes

      // 2. Create booking document
      const bookingData = {
        venueId: groundId,
        userId: user.uid,
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        status: "pending_payment",
        bookingType: "website",
        holdExpiresAt: Timestamp.fromDate(holdExpiresAt),
        createdAt: serverTimestamp(),
        amount: 1000, // TODO: Get from venue pricing
      };

      const bookingRef = await addDoc(collection(db, "bookings"), bookingData);

      // 3. Redirect to payment
      router.push(`/payment/${bookingRef.id}`);

      toast.success("Slot reserved! Complete payment within 5 minutes.");
    } catch (error: any) {
      console.error("Error booking slot:", error);
      toast.error(error.message || "Failed to book slot");
    } finally {
      setIsProcessing(false);
      setBookingDialogOpen(false);
    }
  };

  // ============================================================================
  // Manager Physical Reservation Flow
  // ============================================================================

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
      const bookingId = `physical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create booking in venueSlots
      await bookSlot(
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        {
          bookingId,
          bookingType: "physical",
          status: "confirmed",
          customerName: physicalBookingData.customerName,
          customerPhone: physicalBookingData.customerPhone,
          notes: physicalBookingData.notes,
          userId: user.uid,
        }
      );

      // Create booking document for records
      await addDoc(collection(db, "bookings"), {
        venueId: groundId,
        userId: user.uid,
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        bookingType: "physical",
        status: "confirmed",
        customerName: physicalBookingData.customerName,
        customerPhone: physicalBookingData.customerPhone,
        notes: physicalBookingData.notes,
        createdAt: serverTimestamp(),
        amount: 0, // Physical bookings are managed directly
      });

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

  // ============================================================================
  // Manager Unbook Physical
  // ============================================================================

  const handleUnbookPhysical = async (slot: ReconstructedSlot) => {
    if (!isManager || slot.status !== "BOOKED" || slot.bookingType !== "physical") {
      return;
    }

    if (!confirm(`Unbook slot for ${slot.customerName}?`)) {
      return;
    }

    setIsProcessing(true);

    try {
      await unbookSlot(groundId, slot.date, slot.startTime);
      toast.success("Booking removed successfully");
      await loadSlots();
    } catch (error: any) {
      console.error("Error unbooking slot:", error);
      toast.error(error.message || "Failed to remove booking");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // Manager Block/Unblock Slots
  // ============================================================================

  const handleOpenBlockDialog = (slot: ReconstructedSlot) => {
    setSelectedSlot(slot);
    setBlockReason("");
    setBlockDialogOpen(true);
  };

  const handleBlockSlot = async () => {
    if (!selectedSlot || !user) return;

    setIsProcessing(true);

    try {
      await blockSlot(
        groundId,
        selectedSlot.date,
        selectedSlot.startTime,
        blockReason.trim() || undefined,
        user.uid
      );
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
      await unblockSlot(groundId, slot.date, slot.startTime);
      toast.success("Slot unblocked successfully");
      await loadSlots();
    } catch (error: any) {
      console.error("Error unblocking slot:", error);
      toast.error(error.message || "Failed to unblock slot");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // Slot Styling
  // ============================================================================

  const getSlotClassName = (slot: ReconstructedSlot): string => {
    const baseClasses = "p-2 text-center text-sm rounded border transition-all";
    
    const clickable = canClickSlot(slot);
    const hoverClasses = clickable
      ? "cursor-pointer hover:shadow-md hover:scale-105"
      : "cursor-default";

    switch (slot.status) {
      case "AVAILABLE":
        return `${baseClasses} ${hoverClasses} bg-green-100 border-green-300 text-green-800`;
      
      case "BOOKED":
        if (slot.bookingType === "physical") {
          return `${baseClasses} ${hoverClasses} bg-purple-100 border-purple-300 text-purple-800`;
        }
        return `${baseClasses} bg-yellow-100 border-yellow-300 text-yellow-800`;
      
      case "BLOCKED":
        return `${baseClasses} bg-red-100 border-red-300 text-red-800`;
      
      case "HELD":
        return `${baseClasses} bg-blue-100 border-blue-300 text-blue-800`;
      
      case "RESERVED":
        return `${baseClasses} bg-gray-100 border-gray-300 text-gray-800`;
      
      default:
        return baseClasses;
    }
  };

  const getSlotContent = (slot: ReconstructedSlot): React.ReactNode => {
    switch (slot.status) {
      case "AVAILABLE":
        return (
          <>
            <div className="font-medium">{slot.startTime}</div>
            <div className="text-xs">Available</div>
          </>
        );
      
      case "BOOKED":
        return (
          <>
            <div className="font-medium flex items-center justify-center gap-1">
              {slot.bookingType === "physical" && <Store className="w-3 h-3" />}
              {slot.startTime}
            </div>
            <div className="text-xs truncate">
              {slot.customerName || "Booked"}
            </div>
            {slot.customerPhone && (
              <div className="text-xs truncate">{slot.customerPhone}</div>
            )}
          </>
        );
      
      case "BLOCKED":
        return (
          <>
            <div className="font-medium">{slot.startTime}</div>
            <div className="text-xs">Blocked</div>
            {slot.reason && <div className="text-xs truncate">{slot.reason}</div>}
          </>
        );
      
      case "HELD":
        return (
          <>
            <div className="font-medium">{slot.startTime}</div>
            <div className="text-xs">Held</div>
          </>
        );
      
      case "RESERVED":
        return (
          <>
            <div className="font-medium">{slot.startTime}</div>
            <div className="text-xs">Reserved</div>
            {slot.note && <div className="text-xs truncate">{slot.note}</div>}
          </>
        );
      
      default:
        return slot.startTime;
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

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
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={handlePreviousWeek} variant="outline">
          Previous Week
        </Button>
        
        <div className="text-center">
          <div className="font-semibold text-lg">
            {currentWeekStart.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            -{" "}
            {getWeekEnd(currentWeekStart).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        
        <Button onClick={handleNextWeek} variant="outline">
          Next Week
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs flex-wrap items-center justify-between">
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Booked (Website)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded flex items-center justify-center">
              <Store className="w-2 h-2 text-purple-800" />
            </div>
            <span>Booked (Physical)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>Blocked</span>
          </div>
        </div>
        
        {isManager && (
          <div className="text-sm text-muted-foreground">
            <p>Click available slot to book • Click blocked to unblock • Right-click for options</p>
          </div>
        )}
      </div>

      {/* Slots Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateString = formatDate(date);
          const dateSlots = slotsByDate.get(dateString) || [];

          return (
            <div key={dateString} className="space-y-2">
              <div className="font-semibold text-center text-sm p-2 bg-muted rounded">
                {getDayLabel(date)}
              </div>
              
              <div className="space-y-1">
                {dateSlots.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground p-4">
                    No slots
                  </div>
                ) : (
                  dateSlots.map((slot, idx) => (
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
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white text-xs px-1 rounded-bl"
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

      {/* Booking Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isManager ? "Create Physical Booking" : "Book Slot"}
            </DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <>
                  {formatDate(new Date(selectedSlot.date))} at {selectedSlot.startTime}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {isManager ? (
            <div className="space-y-4">
              <div>
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

              <div>
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

              <div>
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
            <div className="py-4">
              <p>Click "Confirm" to proceed to payment.</p>
            </div>
          )}

          <DialogFooter>
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
              Confirm
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

          <div className="space-y-4">
            <div>
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
