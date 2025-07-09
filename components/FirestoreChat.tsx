"use client"
import { useState, useEffect, useRef } from "react"
import { db } from "@/utils/firebase"
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot, 
  where,
  Timestamp 
} from "firebase/firestore"
import { Send, User, Crown } from "lucide-react"

interface Props {
  currentUser: {
    uid: string
    name: string
    email: string
    userType: "TEAM_LEAD" | "MEMBER"
  }
  roomId: string
  roomName: string
}

interface Message {
  id: string
  roomId: string
  text: string
  timestamp: Timestamp
  author: {
    uid: string
    name: string
    email: string
    userType: "TEAM_LEAD" | "MEMBER"
  }
}

export default function FirestoreChat({ currentUser, roomId, roomName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Real-time messages listener
  useEffect(() => {
    const messagesQuery = query(
      collection(db, "chat_messages"),
      where("roomId", "==", roomId),
      orderBy("timestamp", "asc")
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[]
      
      setMessages(messageList)
    })

    return () => unsubscribe()
  }, [roomId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return
    
    setIsSending(true)
    try {
      await addDoc(collection(db, "chat_messages"), {
        roomId,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        author: {
          uid: currentUser.uid,
          name: currentUser.name,
          email: currentUser.email,
          userType: currentUser.userType,
        },
      })
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Failed to send message. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp) return ""
    return timestamp.toDate().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getUserIcon = (userType: string) => {
    return userType === "TEAM_LEAD" ? (
      <Crown className="w-4 h-4 text-yellow-500" />
    ) : (
      <User className="w-4 h-4 text-green-500" />
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">#{roomName}</h3>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              {getUserIcon(currentUser.userType)}
              {currentUser.name} ({currentUser.userType.replace('_', ' ')})
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {messages.length} messages
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMyMessage = message.author?.uid === currentUser.uid
            const isTeamLead = message.author?.userType === "TEAM_LEAD"
            return (
              <div key={message.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isMyMessage 
                    ? "bg-blue-600 text-white" 
                    : isTeamLead 
                      ? "bg-yellow-100 text-gray-900 border border-yellow-300"
                      : "bg-white text-gray-900 border border-gray-200"
                }`}>
                  {!isMyMessage && (
                    <div className="flex items-center gap-1 text-xs font-medium mb-1">
                      {getUserIcon(message.author?.userType || "MEMBER")}
                      <span className={isTeamLead ? "text-yellow-700" : "text-green-700"}>
                        {message.author?.name} ({message.author?.userType?.replace('_', ' ')})
                      </span>
                    </div>
                  )}
                  <div className="break-words">{message.text}</div>
                  <div className={`text-xs mt-1 ${
                    isMyMessage ? "text-blue-200" : "text-gray-500"
                  }`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t bg-white rounded-b-lg">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message #${roomName}...`}
            className="flex-1 border border-gray-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSending}
          />
          <button 
            onClick={sendMessage} 
            disabled={isSending || !newMessage.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift + Enter for new line
        </div>
      </div>
    </div>
  )
}