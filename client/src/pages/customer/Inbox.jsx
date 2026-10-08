import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import ChatBox from "../../components/chat/ChatBox.jsx";

function previewText(message) {
  if (!message) return "No messages yet";
  if (message.deletedAt) return "Message deleted";
  return message.text || message.attachments?.[0]?.name || "Attachment";
}

export default function Inbox() {
  const { bookingId } = useParams();
  const user = useSelector((state) => state.auth.user);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const processedMessages = useRef(new Set());

  async function loadConversations() {
    try {
      const { data } = await api.get("/chats");
      setConversations(data.conversations);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Your conversations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onMessage = (event) => {
      const message = event.message || event;
      const messageId = String(message._id);
      if (processedMessages.current.has(messageId)) return;
      processedMessages.current.add(messageId);
      if (processedMessages.current.size > 1000) {
        processedMessages.current.delete(processedMessages.current.values().next().value);
      }
      setConversations((current) => current.map((conversation) => {
        if (String(conversation.booking._id) !== String(event.bookingId || message.booking?._id || message.booking)) return conversation;
        const ownMessage = String(message.sender?._id || message.sender) === String(user?._id || user?.id);
        return {
          ...conversation,
          lastMessage: message,
          unreadCount: ownMessage ? conversation.unreadCount : conversation.unreadCount + 1
        };
      }));
    };
    const onRead = (receipt) => {
      if (String(receipt.userId) !== String(user?._id || user?.id)) return;
      setConversations((current) => current.map((conversation) => String(conversation.booking._id) === receipt.bookingId
        ? { ...conversation, unreadCount: 0 }
        : conversation));
    };
    socket.on("chat:notification", onMessage);
    socket.on("chat:message", onMessage);
    socket.on("chat:read", onRead);
    return () => {
      socket.off("chat:notification", onMessage);
      socket.off("chat:message", onMessage);
      socket.off("chat:read", onRead);
    };
  }, [user]);

  const activeConversation = conversations.find((item) => String(item.booking._id) === bookingId);
  const totalUnread = conversations.reduce((total, item) => total + item.unreadCount, 0);

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">MESSAGES {totalUnread > 0 && `· ${totalUnread} UNREAD`}</p>
        <h1 className="mt-3 text-3xl font-semibold">Your inbox</h1>
        <p className="mt-2 text-sm text-slate-400">Booking conversations with your customers and professionals.</p>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading conversations" /></div> : error ? (
          <div role="alert" className="mt-8 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : (
          <div className="mt-8 grid min-h-[65vh] gap-5 lg:grid-cols-[340px_1fr]">
            <Card className="overflow-hidden p-2">
              <div className="max-h-[68vh] overflow-y-auto">
                {conversations.length ? conversations.map((conversation) => (
                  <Link
                    key={conversation.booking._id}
                    to={`/inbox/${conversation.booking._id}`}
                    className={`block rounded-xl p-4 transition ${String(conversation.booking._id) === bookingId ? "bg-accent/10" : "hover:bg-white/[0.04]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><h2 className="truncate font-semibold">{conversation.participant?.name || "Booking conversation"}</h2><p className="mt-1 truncate text-xs text-slate-500">{conversation.booking.service?.title || "Home service"} · {conversation.booking.status}</p></div>
                      {conversation.unreadCount > 0 && <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-midnight">{conversation.unreadCount}</span>}
                    </div>
                    <p className="mt-3 truncate text-sm text-slate-400">{previewText(conversation.lastMessage)}</p>
                    {conversation.lastMessage && <p className="mt-1 text-[10px] text-slate-600">{new Date(conversation.lastMessage.createdAt).toLocaleString()}</p>}
                    {conversation.disabledReason && <p className="mt-2 text-xs text-amber-200">{conversation.disabledReason}</p>}
                  </Link>
                )) : (
                  <div className="px-4 py-12 text-center"><MessageCircle size={25} className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-400">Your booking chats will appear here.</p></div>
                )}
              </div>
            </Card>
            <Card className="min-h-[65vh] overflow-hidden">
              {activeConversation ? (
                <ChatBox key={bookingId} bookingId={bookingId} booking={activeConversation.booking} peer={activeConversation.participant} variant="embedded" />
              ) : (
                <div className="grid min-h-[65vh] place-items-center p-8 text-center"><div><MessageCircle size={30} className="mx-auto text-accent" /><h2 className="mt-4 font-semibold">Choose a conversation</h2><p className="mt-2 text-sm text-slate-400">Select a booking chat from the list.</p></div></div>
              )}
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
