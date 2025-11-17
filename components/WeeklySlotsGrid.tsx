"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface WeeklySlotsGridProps {
  groundId: string;
}

// --- Helper Function ---
const getSlotId = (groundId: string, date: string, startTime: string) => {
  return `${groundId}_${date}_${startTime.replace(":", "")}`;
};

const WeeklySlotsGrid: React.FC<WeeklySlotsGridProps> = ({ groundId }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSlotUpdateDialogOpen, setIsSlotUpdateDialogOpen] = useState(false);
  const [isGenerateSlotsDialogOpen, setIsGenerateSlotsDialogOpen] =
    useState(false);
  const [isBookingConfirmDialogOpen, setIsBookingConfirmDialogOpen] =
    useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<
    any | null
  >(null);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [processingSlotId, setProcessingSlotId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [pricePerHour, setPricePerHour] = useState(0);
  const [isManager, setIsManager] = useState(false);

  const fetchData = useCallback(
    async (isInitialLoad = true) => {
      if (!groundId) return;
      if (isInitialLoad) setLoading(true);
      setError(null);
      try {
        const groundDocRef = doc(db, "venues", groundId);
        const groundDoc = await getDoc(groundDocRef);
        if (!groundDoc.exists()) {
          setError("This venue does not exist.");
          setLoading(false);
          return;
        }
        const groundData = groundDoc.data();
        setIsManager(user && groundData.managedBy === user.uid);
        setPricePerHour(groundData.pricePerHour || 0);
        if (groundData.startTime && groundData.endTime) {
          setStartTime(groundData.startTime);
          setEndTime(groundData.endTime);
        }
        const today = new Date();
        const dates = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(today.getDate() + i);
          return d.toISOString().split("T")[0];
        });
        const slotsQuery = query(
          collection(db, "slots"),
          where("groundId", "==", groundId),
          where("date", "in", dates)
        );
        const slotsSnapshot = await getDocs(slotsQuery);
        setSlots(slotsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("An error occurred while fetching data.");
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    },
    [groundId, user]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHoldSlot = async (date: string, hour: string) => {
    if (!user) {
      toast.error("Please log in to book a slot.");
      return;
    }
    const slotId = getSlotId(groundId, date, hour);
    setProcessingSlotId(slotId);

    try {
      const bookingId = await runTransaction(db, async (transaction) => {
        const slotDocRef = doc(db, "slots", slotId);
        const slotDoc = await transaction.get(slotDocRef);
        const now = Timestamp.now();
        const fiveMinutesFromNow = new Timestamp(
          now.seconds + 300,
          now.nanoseconds
        ); // 5 minute hold

        if (slotDoc.exists()) {
          const slotData = slotDoc.data();
          const isHeld = slotData.status === "HELD";
          const isHoldExpired =
            isHeld &&
            slotData.holdExpiresAt &&
            slotData.holdExpiresAt.toMillis() < now.toMillis();

          if (slotData.status !== "AVAILABLE" && !isHoldExpired) {
            throw new Error("Slot is not available.");
          }
        }

        transaction.set(
          slotDocRef,
          {
            groundId: groundId,
            date: date,
            startTime: hour,
            status: "HELD",
            heldBy: user.uid,
            holdExpiresAt: fiveMinutesFromNow,
          },
          { merge: true }
        );

        const bookingDocRef = doc(collection(db, "bookings"));
        transaction.set(bookingDocRef, {
          userId: user.uid,
          venueId: groundId,
          slotId: slotId,
          date: date,
          startTime: hour,
          status: "PENDING_PAYMENT",
          price: pricePerHour,
          createdAt: serverTimestamp(),
          bookingExpiresAt: fiveMinutesFromNow,
        });

        return bookingDocRef.id;
      });

      setIsBookingConfirmDialogOpen(false);
      toast.success("Slot held for 5 minutes. Redirecting to payment...");
      router.push(`/payment/${bookingId}`);
    } catch (error: any) {
      console.error("Booking transaction failed: ", error);
      toast.error(
        error.message === "Slot is not available."
          ? "This slot was just booked by someone else."
          : "Failed to hold slot. Please try again."
      );
      setIsBookingConfirmDialogOpen(false);
      fetchData(false); // Re-fetch to get the latest slot status
    } finally {
      setProcessingSlotId(null);
    }
  };

  const handleSlotClick = (slot: any, date: string, hour: string) => {
    const now = new Date();
    const slotDateTime = new Date(`${date}T${hour}`);
    if (slotDateTime < now) {
      toast.info("This slot is in the past.");
      return;
    }
    const currentStatus = slot ? slot.status : "AVAILABLE";
    if (isManager) {
      setSelectedSlot(slot || { date, startTime: hour, groundId });
      setIsSlotUpdateDialogOpen(true);
    } else {
      if (currentStatus === "AVAILABLE") {
        setSelectedSlotForBooking({ date, hour, price: pricePerHour });
        setIsBookingConfirmDialogOpen(true);
      } else if (currentStatus === "HELD") {
        toast.warning("This slot is currently on hold.");
      } else {
        toast.info(`This slot is currently ${slot?.status}.`);
      }
    }
  };

  const handleUpdateSlotStatus = async (status: string) => {
    if (!selectedSlot) return;
    const { date, startTime } = selectedSlot;
    const slotId = getSlotId(groundId, date, startTime);
    try {
      const slotRef = doc(db, "slots", slotId);
      await setDoc(
        slotRef,
        {
          groundId,
          date,
          startTime,
          status: status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success(`Slot status updated to ${status}`);
      setIsSlotUpdateDialogOpen(false);
      fetchData(false);
    } catch (error) {
      console.error("Error updating slot:", error);
      toast.error("Failed to update slot");
    }
  };

  const handleGenerateSlots = async () => {
    if (!groundId) return;
    setGeneratingSlots(true);
    const batch = writeBatch(db);
    try {
      const dates = [...Array(7)].map(
        (_, i) =>
          new Date(new Date().setDate(new Date().getDate() + i))
            .toISOString()
            .split("T")[0]
      );
      const startHour = parseInt(startTime.split(":")[0], 10);
      const endHour = parseInt(endTime.split(":")[0], 10);
      dates.forEach((dateString) => {
        for (let hour = startHour; hour < endHour; hour++) {
          const hourString = `${hour.toString().padStart(2, "0")}:00`;
          const slotId = getSlotId(groundId, dateString, hourString);
          const newSlotRef = doc(db, "slots", slotId);
          // We use set with merge to avoid overwriting booked slots unnecessarily
          batch.set(
            newSlotRef,
            {
              groundId: groundId,
              date: dateString,
              startTime: hourString,
              status: "AVAILABLE",
            },
            { merge: true }
          );
        }
      });
      batch.update(doc(db, "venues", groundId), { startTime, endTime });
      await batch.commit();
      toast.success("Weekly slots generated successfully!");
      setIsGenerateSlotsDialogOpen(false);
      fetchData(false);
    } catch (err) {
      console.error("Failed to generate slots", err);
      toast.error("An error occurred during slot generation.");
    } finally {
      setGeneratingSlots(false);
    }
  };

  const getStatusInfo = (status: string | null) => {
    if (!status)
      return {
        text: "Avail.",
        color: "bg-green-200",
        hover: "hover:bg-green-300",
      };
    switch (status.toUpperCase()) {
      case "AVAILABLE":
        return {
          text: "Avail.",
          color: "bg-green-200",
          hover: "hover:bg-green-300",
        };
      case "BOOKED":
        return {
          text: "Booked",
          color: "bg-yellow-400",
          hover: "cursor-not-allowed",
        };
      case "HELD":
        return {
          text: "Held",
          color: "bg-blue-400",
          hover: "cursor-not-allowed",
        };
      case "RESERVED":
        return {
          text: "Reserv.",
          color: "bg-orange-400",
          hover: "hover:bg-orange-500",
        };
      case "BLOCKED":
        return {
          text: "Blocked",
          color: "bg-red-400",
          hover: "hover:bg-red-500",
        };
      default:
        return { text: "", color: "bg-gray-100", hover: "" };
    }
  };

  const weekDates = [...Array(7)].map(
    (_, i) => new Date(new Date().setDate(new Date().getDate() + i))
  );
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const gridHours = Array.from(
    {
      length: Math.max(
        0,
        parseInt(endTime.split(":")[0]) - parseInt(startTime.split(":")[0])
      ),
    },
    (_, i) =>
      `${(parseInt(startTime.split(":")[0]) + i)
        .toString()
        .padStart(2, "0")}:00`
  );

  if (loading)
    return (
      <div className="p-4 flex justify-center items-center">
        <Loader2 className="animate-spin mr-2" />
        Loading slots...
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-red-500 bg-red-100 border border-red-200 rounded-md">
        {error}
      </div>
    );

  const renderSlot = (date: Date, hour: string, isMobile: boolean = false) => {
    const dateString = date.toISOString().split("T")[0];
    const slotId = getSlotId(groundId, dateString, hour);
    const slot = slots.find((s) => s.id === slotId);

    let isPast = new Date(`${dateString}T${hour}`) < new Date();
    let slotStatus = slot ? slot.status : "AVAILABLE";

    if (
      slotStatus === "HELD" &&
      slot.holdExpiresAt &&
      slot.holdExpiresAt.toMillis() < Date.now()
    ) {
      slotStatus = "AVAILABLE";
    }

    const status = isPast ? null : slotStatus;
    const statusInfo = getStatusInfo(status);
    const canClick = !isPast && !isManager && status === "AVAILABLE";
    const cellClass = isPast
      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
      : `${statusInfo.color} ${
          canClick ? statusInfo.hover : "cursor-not-allowed"
        }`;
    const isProcessing = processingSlotId === slotId;

    return (
      <div
        key={slotId}
        className={`rounded text-center font-semibold transition-colors duration-150 relative ${
          canClick ? "cursor-pointer" : ""
        } ${cellClass} flex flex-col justify-center items-center ${
          isMobile ? "h-16 text-xs p-1" : "h-full text-sm"
        }`}
        onClick={() =>
          (canClick || isManager) &&
          !isProcessing &&
          handleSlotClick(slot, dateString, hour)
        }
      >
        {isProcessing && !isManager ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {isMobile && (
              <div className="text-xs">{`${hour.split(":")[0]}-${String(
                parseInt(hour.split(":")[0]) + 1
              ).padStart(2, "0")}`}</div>
            )}
            <div className="font-bold text-[11px] uppercase">
              {isPast ? "Past" : statusInfo.text}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {isManager && (
        <Button
          onClick={() => setIsGenerateSlotsDialogOpen(true)}
          className="mb-4"
        >
          {slots.length > 0 ? "Re-Generate Slots" : "Generate Weekly Slots"}
        </Button>
      )}

      {slots.length === 0 && !isManager && !loading && (
        <div className="p-6 text-center bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700">
            No Slots Available
          </h3>
          <p className="text-muted-foreground mt-1">
            The venue manager has not made any time slots available for booking
            yet. Please check back later.
          </p>
        </div>
      )}

      {(slots.length > 0 || isManager) && (
        <>
          {/* Mobile View */}
          <div className="sm:hidden">
            {weekDates.map((date) => (
              <div key={date.toISOString()} className="mb-4">
                <h3 className="font-bold text-lg mb-2">
                  {days[date.getDay()]}{" "}
                  <span className="text-sm text-muted-foreground">
                    ({date.getDate()})
                  </span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {gridHours.map((hour) => renderSlot(date, hour, true))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block overflow-x-auto border border-gray-200 rounded-lg isolate">
            <div
              className="grid text-center text-sm"
              style={{ gridTemplateColumns: "120px repeat(7, 90px)" }}
            >
              <div className="font-bold py-3 px-2 sticky left-0 bg-gray-100 z-20 border-b border-r">
                Time
              </div>
              {weekDates.map((date) => (
                <div
                  key={date.toISOString()}
                  className="font-bold py-2 px-1 border-b"
                >
                  <div>{days[date.getDay()]}</div>
                  <div className="text-xs text-muted-foreground">
                    {date.getDate()}
                  </div>
                </div>
              ))}
              {gridHours.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="font-semibold h-14 whitespace-nowrap text-xs flex items-center justify-center sticky left-0 bg-white z-10 border-b border-t border-r">{`${hour} - ${(
                    parseInt(hour.split(":")[0]) + 1
                  )
                    .toString()
                    .padStart(2, "0")}:00`}</div>
                  {weekDates.map((date) => (
                    <div
                      key={date.toISOString()}
                      className="border-b border-t p-1 h-14"
                    >
                      {renderSlot(date, hour)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}

      {/* --- Dialogs --- */}
      <Dialog
        open={isBookingConfirmDialogOpen}
        onOpenChange={setIsBookingConfirmDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Slot</DialogTitle>
            <DialogDescription>
              You will have 5 minutes to complete the payment once you proceed.
            </DialogDescription>
          </DialogHeader>
          {selectedSlotForBooking && (
            <div className="py-4 space-y-3">
              <p>
                <strong>Date:</strong> {selectedSlotForBooking.date}
              </p>
              <p>
                <strong>Time:</strong> {selectedSlotForBooking.hour} -{" "}
                {(parseInt(selectedSlotForBooking.hour.split(":")[0]) + 1)
                  .toString()
                  .padStart(2, "0")}
                :00
              </p>
              <p>
                <strong>Price:</strong> Rs. {pricePerHour}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBookingConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSlotForBooking) {
                  handleHoldSlot(
                    selectedSlotForBooking.date,
                    selectedSlotForBooking.hour
                  );
                }
              }}
              disabled={processingSlotId !== null}
            >
              {processingSlotId ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Please wait
                </>
              ) : (
                "Go to Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGenerateSlotsDialogOpen}
        onOpenChange={setIsGenerateSlotsDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Weekly Slots</DialogTitle>
            <DialogDescription>
              Define the operating hours. This will create 'Available' slots for
              the next 7 days and overwrite any existing slots for that period.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleGenerateSlots} disabled={generatingSlots}>
              {generatingSlots ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSlotUpdateDialogOpen}
        onOpenChange={setIsSlotUpdateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Slot Status (Manager)</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <p className="py-4">
              Update slot for <strong>{selectedSlot.date}</strong> at{" "}
              <strong>{selectedSlot.startTime}</strong>
            </p>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              onClick={() => handleUpdateSlotStatus("AVAILABLE")}
              variant="outline"
            >
              Available
            </Button>
            <Button
              onClick={() => handleUpdateSlotStatus("RESERVED")}
              variant="outline"
            >
              Reserved
            </Button>
            <Button
              onClick={() => handleUpdateSlotStatus("BLOCKED")}
              variant="destructive"
            >
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklySlotsGrid;
