"use client";
import { useEffect, useRef, useState } from "react";
import { db } from "@/utils/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function FirestoreTeamChat({ roomId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Listen for messages in real time
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "room_messages"),
      where("roomId", "==", roomId),
      orderBy("timestamp")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });
    return () => unsub();
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "room_messages"), {
      roomId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      message: input.trim(),
      timestamp: serverTimestamp(),
    });
    setInput("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts) =>
    ts?.toDate
      ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  return (
    <div className="bg-white p-4 rounded-xl shadow-md max-w-2xl mx-auto mt-6">
      <div className="h-64 overflow-y-auto border rounded p-3 bg-gray-50 mb-4 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    isSelf
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  {!isSelf && (
                    <div className="text-xs font-bold mb-1">{msg.userName}</div>
                  )}
                  <div className="text-sm">{msg.message}</div>
                  <div
                    className={`text-xs mt-1 ${
                      isSelf ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="border px-4 py-2 rounded w-full"
          placeholder="Type your message..."
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
} 