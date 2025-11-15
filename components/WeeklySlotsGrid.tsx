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
  updateDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
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

interface WeeklySlotsGridProps {
  groundId: string;
}

const WeeklySlotsGrid: React.FC<WeeklySlotsGridProps> = ({ groundId }) => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isSlotUpdateDialogOpen, setIsSlotUpdateDialogOpen] = useState(false);
  const [isGenerateSlotsDialogOpen, setIsGenerateSlotsDialogOpen] =
    useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [pricePerHour, setPricePerHour] = useState(0);
  const [isManager, setIsManager] = useState(false);

  const fetchData = useCallback(async () => {
    if (!groundId) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [groundId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        setSelectedSlot({
          date,
          startTime: hour,
          groundId,
          price: pricePerHour,
        });
        setIsBookingDialogOpen(true);
      } else {
        toast.info(`This slot is currently ${slot.status}.`);
      }
    }
  };

  const handleUpdateSlotStatus = async (status: string) => {
    if (!selectedSlot) return;
    try {
      if (selectedSlot.id) {
        await updateDoc(doc(db, "slots", selectedSlot.id), { status });
      } else {
        await addDoc(collection(db, "slots"), {
          ...selectedSlot,
          status,
          createdAt: serverTimestamp(),
        });
      }
      toast.success(`Slot status updated to ${status}`);
      setIsSlotUpdateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error updating slot:", error);
      toast.error("Failed to update slot");
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !user) return;
    const { date, startTime, groundId, price } = selectedSlot;
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "bookings")), {
        userId: user.uid,
        venueId: groundId,
        date,
        startTime,
        status: "CONFIRMED",
        price,
        createdAt: serverTimestamp(),
      });
      const existingSlot = slots.find(
        (s) => s.date === date && s.startTime === startTime
      );
      if (existingSlot) {
        batch.update(doc(db, "slots", existingSlot.id), { status: "BOOKED" });
      } else {
        batch.set(doc(collection(db, "slots")), {
          groundId,
          date,
          startTime,
          status: "BOOKED",
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      toast.success("Booking confirmed!");
      setIsBookingDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Booking failed:", error);
      toast.error("Failed to confirm booking.");
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
          const newSlotRef = doc(collection(db, "slots"));
          batch.set(newSlotRef, {
            groundId: groundId,
            date: dateString,
            startTime: `${hour.toString().padStart(2, "0")}:00`,
            endTime: `${(hour + 1).toString().padStart(2, "0")}:00`,
            status: "AVAILABLE",
            createdAt: serverTimestamp(),
          });
        }
      });
      batch.update(doc(db, "venues", groundId), { startTime, endTime });
      await batch.commit();
      toast.success("Weekly slots generated successfully!");
      setIsGenerateSlotsDialogOpen(false);
      fetchData();
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
      length:
        parseInt(endTime.split(":")[0]) - parseInt(startTime.split(":")[0]),
    },
    (_, i) =>
      `${(parseInt(startTime.split(":")[0]) + i)
        .toString()
        .padStart(2, "0")}:00`
  );

  if (loading) return <div className="p-4">Loading slots...</div>;
  if (error)
    return (
      <div className="p-4 text-red-500 bg-red-100 border border-red-200 rounded-md">
        {error}
      </div>
    );
  if (isManager && slots.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground mb-4">
          No slots have been generated for this venue.
        </p>
        <Button onClick={() => setIsGenerateSlotsDialogOpen(true)}>
          Generate Weekly Slots
        </Button>
      </div>
    );
  }

  const renderSlot = (date: Date, hour: string, isMobile: boolean = false) => {
    const dateString = date.toISOString().split("T")[0];
    const slot = slots.find(
      (s) => s.date === dateString && s.startTime === hour
    );
    const isPast = new Date(`${dateString}T${hour}`) < new Date();
    const status = isPast ? null : slot ? slot.status : "AVAILABLE";
    const statusInfo = getStatusInfo(status);
    const canClick = !isPast && (isManager || status === "AVAILABLE");
    const cellClass = isPast
      ? "bg-gray-300 cursor-not-allowed"
      : `${statusInfo.color} ${
          canClick ? statusInfo.hover : "cursor-not-allowed"
        }`;

    return (
      <div
        key={`${dateString}-${hour}`}
        className={`p-1 rounded-md text-center font-semibold ${
          canClick ? "cursor-pointer" : ""
        } ${cellClass} flex flex-col justify-center items-center ${
          isMobile ? "h-16 text-xs" : "h-full text-sm"
        }`}
        onClick={() => canClick && handleSlotClick(slot, dateString, hour)}
      >
        {isMobile && (
          <div className="text-xs">{`${hour.split(":")[0]}-${String(
            parseInt(hour.split(":")[0]) + 1
          ).padStart(2, "0")}`}</div>
        )}
        <div className="font-bold text-[11px] uppercase">
          {isPast ? "Past" : statusInfo.text}
        </div>
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
          Re-Generate Slots
        </Button>
      )}

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
      <div className="hidden sm:block overflow-x-auto border rounded-lg">
        <div
          className="grid text-center text-sm"
          style={{
            gridTemplateColumns:
              "minmax(120px, auto) repeat(7, minmax(90px, 1fr))",
          }}
        >
          <div className="font-bold py-3 px-2 sticky left-0 bg-white z-20 border-b border-r">
            Time
          </div>
          {weekDates.map((date) => (
            <div
              key={date.toISOString()}
              className="font-bold py-3 px-2 border-b"
            >
              <div>{days[date.getDay()]}</div>
              <div className="text-xs text-muted-foreground">
                {date.getDate()}
              </div>
            </div>
          ))}

          {gridHours.map((hour, idx) => (
            <React.Fragment key={hour}>
              <div className="font-bold py-3 px-2 whitespace-nowrap text-xs flex items-center justify-center sticky left-0 bg-white z-10 border-r border-gray-200">{`${hour} - ${(
                parseInt(hour.split(":")[0]) + 1
              )
                .toString()
                .padStart(2, "0")}:00`}</div>
              {weekDates.map((date) => (
                <div key={date.toISOString()} className="p-2">
                  {renderSlot(date, hour)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog
        open={isGenerateSlotsDialogOpen}
        onOpenChange={setIsGenerateSlotsDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Weekly Slots</DialogTitle>
            <DialogDescription>
              Define the operating hours. This will create 'Available' slots for
              the next 7 days and replace any existing slots.
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

      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Booking</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="py-4 space-y-1">
              <p>
                <strong>Date:</strong> {selectedSlot.date}
              </p>
              <p>
                <strong>Time:</strong> {selectedSlot.startTime} -{" "}
                {(parseInt(selectedSlot.startTime.split(":")[0]) + 1)
                  .toString()
                  .padStart(2, "0")}
                :00
              </p>
              <p className="text-lg font-bold mt-2">
                <strong>Price:</strong> Rs. {selectedSlot.price}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBookingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmBooking}>Confirm Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklySlotsGrid;
