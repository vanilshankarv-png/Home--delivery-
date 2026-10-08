import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";

const quickTags = ["On time", "Professional", "Great work", "Friendly", "Good value"];

export default function ReviewModal({ open, onClose, bookingId, serviceTitle, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag) {
    setTags((current) => current.includes(tag)
      ? current.filter((selected) => selected !== tag)
      : [...current, tag]);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/reviews", { bookingId, rating, comment, tags });
      toast.success("Thanks for sharing your review.");
      onSubmitted?.(data.review);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Your review could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Rate your experience">
      <form onSubmit={submit} className="grid gap-5">
        <p className="text-sm text-slate-400">How was {serviceTitle || "your service"}?</p>
        <div className="flex justify-center gap-2" onMouseLeave={() => setHovered(0)} role="radiogroup" aria-label="Rating from one to five stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <motion.button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              whileHover={{ scale: 1.2, rotate: -8 }}
              whileTap={{ scale: 0.9 }}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onClick={() => setRating(value)}
              className="rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Star className={`h-9 w-9 transition-colors ${(hovered || rating) >= value ? "fill-amber-300 text-amber-300" : "text-slate-600"}`} />
            </motion.button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)} className={`rounded-full border px-3 py-1.5 text-xs transition ${tags.includes(tag) ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-slate-400 hover:text-white"}`}>{tag}</button>)}
        </div>
        <label className="grid gap-2 text-sm font-medium text-slate-200">Your review<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="Share a few details about your experience..." className="resize-y rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent/60" /></label>
        <p className="-mt-3 text-right text-xs text-slate-500">{comment.length}/2000</p>
        <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit review"}</Button>
      </form>
    </Modal>
  );
}
