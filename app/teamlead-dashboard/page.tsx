"use client"
import { useEffect, useState } from "react"
import { auth, db } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import LogoutButton from "@/components/LogoutButton"
import FirestoreChat from "@/components/FirestoreChat"
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, deleteDoc } from "firebase/firestore"
import { Users, Calendar, MessageSquare, Key, Plus, Copy, Trash2, Crown, UserPlus } from "lucide-react"

export default function TeamLeadDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [teamName, setTeamName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [teamInfo, setTeamInfo] = useState<any>(null)
  const [events, setEvents] = useState<{ title: string; date: string; description: string }[]>([])
  const [eventTitle, setEventTitle] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventDesc, setEventDesc] = useState("")

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login")
        return
      }
      const leadData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Team Lead",
        email: firebaseUser.email || "",
        userType: "TEAM_LEAD",
      }
      try {
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            ...leadData,
            lastLogin: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (error) {
        console.error("Error storing user data:", error)
      }
      setUser(leadData)

      try {
        const memberQuery = query(collection(db, "team_members"), where("uid", "==", leadData.uid))
        const memberSnapshot = await getDocs(memberQuery)
        if (!memberSnapshot.empty) {
          const memberData = memberSnapshot.docs[0].data()
          setTeamInfo({
            teamName: memberData.teamName,
            teamLeadId: memberData.teamLeadId,
            joinedAt: memberData.joinedAt,
          })

          const q = query(collection(db, "team_members"), where("teamLeadId", "==", memberData.teamLeadId))
          const snap = await getDocs(q)
          const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          setMembers(list)
        }
      } catch (error) {
        console.error("Error checking team membership for team lead:", error)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const generateCode = async () => {
    if (!teamName.trim()) {
      alert("Please enter a team name")
      return
    }
    setIsGenerating(true)
    const code = Math.random().toString(36).substr(2, 6).toUpperCase()
    try {
      await addDoc(collection(db, "team_invites"), {
        code,
        teamName,
        teamLeadId: user.uid,
        teamLeadName: user.name,
        teamLeadEmail: user.email,
        createdAt: serverTimestamp(),
        isActive: true,
      })

      await addDoc(collection(db, "team_members"), {
        uid: user.uid,
        name: user.name,
        email: user.email,
        userType: "TEAM_LEAD",
        teamLeadId: user.uid,
        teamLeadName: user.name,
        teamLeadEmail: user.email,
        teamName: teamName,
        joinedAt: serverTimestamp(),
      })
      setInviteCode(code)
      setShowForm(false)

      const q = query(collection(db, "team_members"), where("teamLeadId", "==", user.uid))
      const snap = await getDocs(q)
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setMembers(list)
      setTeamInfo({
        teamName: teamName,
        teamLeadId: user.uid,
      })
    } catch (error: any) {
      alert("❌ Error: " + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from the team?`)) return
    try {
      await deleteDoc(doc(db, "team_members", memberId))
      if (teamInfo) {
        const q = query(collection(db, "team_members"), where("teamLeadId", "==", teamInfo.teamLeadId))
        const snap = await getDocs(q)
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setMembers(list)
      }
    } catch (err) {
      alert("Failed to remove member.")
      console.error(err)
    }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode)
    alert("Invite code copied to clipboard!")
  }

  if (!user || isLoading) {
    return (
      <div className="h-screen flex justify-center items-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-semibold text-gray-700">Loading your dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Team Lead Dashboard
                </h1>
                <p className="text-sm text-gray-600">Manage your team and projects</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Crown className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">Team Lead</div>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Team Creation/Invite Code Section */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 rounded-3xl"></div>

            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Team Invite Management</h2>
                    <p className="text-gray-600">Create and manage team invitations</p>
                  </div>
                </div>
                {!showForm && !inviteCode && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Team
                  </button>
                )}
              </div>

              {showForm ? (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Team Name</label>
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter your team name"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/80"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={generateCode}
                      disabled={isGenerating || !teamName.trim()}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center"
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5 mr-2" />
                          Generate Code
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                inviteCode && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-green-800 mb-2">🎉 Team Created Successfully!</h3>
                        <p className="text-green-700 mb-4">Share this invite code with your team members:</p>
                        <div className="flex items-center space-x-4">
                          <div className="bg-white px-6 py-3 rounded-xl border-2 border-green-300">
                            <span className="font-mono text-2xl font-bold text-gray-900 tracking-wider">
                              {inviteCode}
                            </span>
                          </div>
                          <button
                            onClick={copyInviteCode}
                            className="bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center"
                          >
                            <Copy className="w-5 h-5 mr-2" />
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Team Members */}
            <div className="lg:col-span-1">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Team Members</h3>
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {members.length}
                  </div>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {members.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No team members yet</p>
                      <p className="text-sm text-gray-400">Share your invite code to get started</p>
                    </div>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold ${
                              member.userType === "TEAM_LEAD"
                                ? "bg-gradient-to-br from-blue-500 to-purple-600"
                                : "bg-gradient-to-br from-green-500 to-teal-600"
                            }`}
                          >
                            {member.userType === "TEAM_LEAD" ? (
                              <Crown className="w-5 h-5" />
                            ) : (
                              member.name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              member.userType === "TEAM_LEAD"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {member.userType === "TEAM_LEAD" ? "Lead" : "Member"}
                          </span>
                          {member.userType !== "TEAM_LEAD" && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Events and Chat */}
            <div className="lg:col-span-2 space-y-8">
              {/* Team Events */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Team Events</h3>
                  </div>
                  <div className="text-sm text-gray-500">{events.length} events</div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!eventTitle || !eventDate) return
                    setEvents([...events, { title: eventTitle, date: eventDate, description: eventDesc }])
                    setEventTitle("")
                    setEventDate("")
                    setEventDesc("")
                  }}
                  className="grid md:grid-cols-2 gap-4 mb-6"
                >
                  <input
                    type="text"
                    placeholder="Event Title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                    required
                  />
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                    required
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="md:col-span-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80 resize-none"
                    rows={2}
                  />
                  <button
                    type="submit"
                    className="md:col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Event
                  </button>
                </form>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No events scheduled</p>
                      <p className="text-sm text-gray-400">Add your first team event above</p>
                    </div>
                  ) : (
                    events.map((event, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                            <div className="text-sm text-purple-600 mb-2">{event.date}</div>
                            {event.description && <div className="text-sm text-gray-600">{event.description}</div>}
                          </div>
                          <button
                            onClick={() => {
                              const newEvents = events.filter((_, i) => i !== idx)
                              setEvents(newEvents)
                            }}
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Section */}
              {teamInfo && (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Team Chat</h3>
                  </div>

                  <FirestoreChat currentUser={user} roomId={teamInfo.teamLeadId} roomName={teamInfo.teamName} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
