import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, MessageCircle, Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import { useSelector } from "react-redux";
import Button from "../ui/Button.jsx";

function dayLabel(date) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) return "Today";
  if (value.toDateString() === yesterday.toDateString()) return "Yesterday";
  return value.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function MessageBubble({ message, mine }) {
  const deleted = Boolean(message.deletedAt);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md bg-accent/20 text-white" : "rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-100"}`}>
        {deleted ? <p className="text-sm italic text-slate-400">This message was deleted.</p> : (
          <>
            {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>}
            {message.attachments?.map((attachment, index) => (
              <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-accent underline">{attachment.name || "Attachment"}</a>
            ))}
          </>
        )}
        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-slate-300" : "text-slate-500"}`}>
          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
          {mine && (message.readAt ? <CheckCheck size={13} className="text-cyan-300" /> : <Check size={13} />)}
        </div>
      </div>
    </div>
  );
}

function ChatContents({ bookingId, booking, peer, embedded = false }) {
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [disabledReason, setDisabledReason] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const pendingIds = useRef(new Map());
  const previousScroll = useRef(null);
  const bookingStatus = booking?.status;

  const peerName = useMemo(() => {
    if (peer?.name) return peer.name;
    const peerParticipant = String(booking?.customer?._id || booking?.customer || "") === currentUserId
      ? booking?.provider
      : booking?.customer;
    return peerParticipant?.name || "Booking participant";
  }, [booking, currentUserId, peer]);

  const loadMessages = useCallback(async ({ older = false } = {}) => {
    try {
      setError("");
      if (older && scrollRef.current) {
        previousScroll.current = {
          height: scrollRef.current.scrollHeight,
          top: scrollRef.current.scrollTop
        };
      }
      const params = older && cursor ? { cursor } : {};
      const { data } = await api.get(`/chats/${bookingId}/messages`, { params });
      setMessages((current) => {
        const combined = older ? [...data.messages, ...current] : data.messages;
        return [...new Map(combined.map((message) => [String(message._id), message])).values()];
      });
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setDisabledReason("");
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Chat messages could not be loaded.";
      if (requestError.response?.status === 409) setDisabledReason(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, cursor]);

  const markRead = useCallback(async () => {
    if (socket.connected) {
      socket.emit("chat:read", { bookingId });
      return;
    }
    try {
      await api.put(`/chats/${bookingId}/read`);
    } catch (requestError) {
      if (requestError.response?.status !== 409) {
        console.error("Unable to mark booking chat as read:", requestError);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setLoading(true);
    void loadMessages();
  }, [bookingId]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const join = () => socket.emit("booking:join", bookingId, (result) => {
      if (!result?.success) {
        setError(result?.message || "Chat connection is unavailable.");
        return;
      }
      void markRead();
    });
    const receiveMessage = (message) => {
      if (String(message.booking) !== bookingId && String(message.booking?._id) !== bookingId) return;
      setMessages((current) => {
        let updated = current;
        if (message.clientMessageId) {
          updated = current.filter((item) => item.clientMessageId !== message.clientMessageId);
          pendingIds.current.delete(message.clientMessageId);
        }
        return updated.some((item) => String(item._id) === String(message._id))
          ? updated.map((item) => String(item._id) === String(message._id) ? { ...item, ...message } : item)
          : [...updated, message];
      });
      if (String(message.receiver?._id || message.receiver) === currentUserId) void markRead();
    };
    const receiveTyping = (event) => {
      if (event.bookingId === bookingId && event.userId !== currentUserId) setTyping(event.isTyping);
    };
    const receiveReceipt = (receipt) => {
      if (receipt.bookingId !== bookingId || receipt.userId === currentUserId) return;
      setMessages((current) => current.map((message) => (
        String(message.sender?._id || message.sender) === currentUserId && !message.readAt
          && new Date(message.createdAt) <= new Date(receipt.readAt)
          ? { ...message, readAt: receipt.readAt }
          : message
      )));
    };
    const receiveDeleted = (event) => {
      if (event.bookingId !== bookingId) return;
      setMessages((current) => current.map((message) => String(message._id) === event._id
        ? { ...message, deletedAt: event.deletedAt }
        : message));
    };
    const receiveChatError = (event) => {
      if (event.bookingId === bookingId) setError(event.message || "Chat update failed.");
    };
    socket.on("connect", join);
    socket.on("chat:message", receiveMessage);
    socket.on("chat:typing", receiveTyping);
    socket.on("chat:read", receiveReceipt);
    socket.on("chat:deleted", receiveDeleted);
    socket.on("chat:error", receiveChatError);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("chat:message", receiveMessage);
      socket.off("chat:typing", receiveTyping);
      socket.off("chat:read", receiveReceipt);
      socket.off("chat:deleted", receiveDeleted);
      socket.off("chat:error", receiveChatError);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [bookingId, currentUserId, markRead]);

  useEffect(() => {
    if (previousScroll.current && scrollRef.current) {
      const current = scrollRef.current;
      current.scrollTop = previousScroll.current.top + current.scrollHeight - previousScroll.current.height;
      previousScroll.current = null;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || disabledReason) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic = {
      _id: `pending:${clientMessageId}`,
      clientMessageId,
      booking: bookingId,
      sender: { _id: currentUserId, name: currentUser?.name },
      text,
      attachments: [],
      createdAt: new Date().toISOString(),
      optimistic: true
    };
    setMessages((current) => [...current, optimistic]);
    pendingIds.current.set(clientMessageId, true);
    setDraft("");
    setSending(true);
    try {
      if (socket.connected) {
        socket.timeout(10_000).emit("chat:send", { bookingId, text, clientMessageId }, (timeoutError, result) => {
          if (timeoutError || !result?.success) {
            pendingIds.current.delete(clientMessageId);
            setMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
            setDraft((current) => current || text);
            toast.error(result?.message || "Chat connection timed out. Please try again.");
          } else {
            setMessages((current) => current.map((item) => item.clientMessageId === clientMessageId
              ? { ...result.message, clientMessageId }
              : item));
            pendingIds.current.delete(clientMessageId);
          }
          setSending(false);
        });
      } else {
        const { data } = await api.post(`/chats/${bookingId}/messages`, { text });
        setMessages((current) => current.map((item) => item.clientMessageId === clientMessageId
          ? data.message
          : item));
        pendingIds.current.delete(clientMessageId);
        setSending(false);
      }
    } catch (requestError) {
      setMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
      setDraft(text);
      setSending(false);
      toast.error(requestError.response?.data?.message || "Message could not be sent.");
    }
  }

  function updateDraft(value) {
    setDraft(value);
    if (!socket.connected) return;
    socket.emit("chat:typing", { bookingId, isTyping: Boolean(value.trim()) });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("chat:typing", { bookingId, isTyping: false }), 1500);
  }

  let lastDay = "";
  return (
    <section className={`flex min-h-0 flex-col ${embedded ? "h-[68vh]" : "h-full"}`}>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0"><h2 className="truncate font-semibold">{peerName}</h2><p className="truncate text-xs text-slate-500">{booking?.service?.title || "Booking chat"} · #{bookingId.slice(-6)}</p></div>
        {bookingStatus && <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">{bookingStatus.replaceAll("_", " ")}</span>}
      </header>
      {error && <p role="alert" className="px-4 py-2 text-xs text-rose-200">{error}</p>}
      {disabledReason && <p role="status" className="border-b border-white/10 px-4 py-3 text-xs text-amber-200">{disabledReason}</p>}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {hasMore && <button type="button" onClick={() => loadMessages({ older: true })} className="mx-auto block text-xs font-semibold text-accent hover:text-white">Load earlier messages</button>}
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading messages…</p> : messages.map((message) => {
          const day = dayLabel(message.createdAt);
          const showDate = day !== lastDay;
          lastDay = day;
          return (
            <div key={message._id}>
              {showDate && <div className="my-3 text-center"><span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] text-slate-500">{day}</span></div>}
              <MessageBubble message={message} mine={String(message.sender?._id || message.sender) === currentUserId} />
            </div>
          );
        })}
        {typing && <p className="text-xs italic text-slate-500">Typing…</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-white/10 p-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600"><Paperclip size={16} /></span>
        <textarea
          aria-label="Write a message"
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
          maxLength={4000}
          rows={1}
          disabled={Boolean(disabledReason)}
          placeholder={disabledReason ? "Chat is closed" : "Message…"}
          className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-white/10 bg-midnight px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent/50 disabled:opacity-50"
        />
        <Button type="submit" aria-label="Send message" disabled={!draft.trim() || sending || Boolean(disabledReason)} className="h-10 w-10 shrink-0 px-0 py-0"><Send size={16} /></Button>
      </form>
    </section>
  );
}

export default function ChatBox({ bookingId, booking, peer, variant = "panel" }) {
  const [open, setOpen] = useState(variant === "embedded");
  const embedded = variant === "embedded";
  return (
    <>
      {!embedded && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Open booking chat" className="fixed bottom-5 right-5 z-[1200] inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-midnight shadow-xl shadow-black/40 hover:brightness-110">
          <MessageCircle size={18} />Chat
        </button>
      )}
      <AnimatePresence>
        {(open || embedded) && (
          <motion.div
            initial={embedded ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            className={embedded
              ? "overflow-hidden rounded-2xl border border-white/10 bg-[#0d1220]"
              : "fixed inset-y-0 right-0 z-[1300] flex w-full max-w-md flex-col border-l border-white/10 bg-[#0d1220] shadow-2xl shadow-black/50"}
          >
            {!embedded && <div className="flex justify-end border-b border-white/10 px-3 py-2"><button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={17} /></button></div>}
            <ChatContents bookingId={bookingId} booking={booking} peer={peer} embedded={embedded} />
          </motion.div>
        )}
      </AnimatePresence>
      {!embedded && open && <button type="button" onClick={() => setOpen(false)} aria-label="Close chat panel" className="fixed inset-0 z-[1250] cursor-default bg-black/50" />}
    </>
  );
}
