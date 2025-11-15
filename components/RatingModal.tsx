"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface RatingModalProps {
  bookingId: string;
  venueId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  currentRating?: number;
  currentReview?: string;
}

const RatingModal = ({
  bookingId,
  venueId,
  userId,
  isOpen,
  onClose,
  currentRating,
  currentReview,
}: RatingModalProps) => {
  const [rating, setRating] = useState(currentRating || 0);
  const [review, setReview] = useState(currentReview || "");

  const handleRating = async () => {
    const reviewDocRef = doc(db, "reviews", `${venueId}_${userId}`);
    try {
      await setDoc(
        reviewDocRef,
        {
          venueId,
          userId,
          rating,
          comment: review,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const bookingDocRef = doc(db, "bookings", bookingId);
      await setDoc(bookingDocRef, { rated: true }, { merge: true });

      toast.success("Thank you for your feedback!");
      onClose();
    } catch (error) {
      toast.error("Failed to submit your rating. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex justify-center mb-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-8 h-8 cursor-pointer ${
                  i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
                }`}
                onClick={() => setRating(i + 1)}
              />
            ))}
          </div>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Leave a review (optional)"
          />
        </div>
        <DialogFooter>
          <Button onClick={handleRating}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingModal;
