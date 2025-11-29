"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleRating = async () => {
    if (!user) {
      toast.error('Please sign in to submit a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();

      const resp = await fetch(`/api/venues/${venueId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ rating, comment: review, bookingId }),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        console.error('Rating API failed:', json);
        toast.error(json?.error || 'Failed to submit your rating. Please try again.');
        return;
      }

      toast.success('Thank you for your feedback!');
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit your rating. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          <Button onClick={handleRating} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingModal;
