"use client"
import { useEffect, useState } from "react"
import { auth, db } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import LogoutButton from "@/components/LogoutButton"
import FirestoreChat from "@/components/FirestoreChat"
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore"
import { Users, Calendar, MessageSquare, Key, CheckCircle, Clock, Sparkles } from "lucide-react"

export default function MemberDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [teamInfo, setTeamInfo] = useState<any>(null)
  const [events, setEvents] = useState<{ title: string; date: string; description: string }[]>([])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login")
        return
      }

      const currentUserData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Member",
        email: firebaseUser.email || "",
        userType: "MEMBER",
      }

      try {
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            ...currentUserData,
            lastLogin: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (error) {
        console.error("Error storing user data:", error)
      }

      try {
        const memberQuery = query(collection(db, "team_members"), where("uid", "==", firebaseUser.uid))
        const memberSnapshot = await getDocs(memberQuery)

        if (!memberSnapshot.empty) {
          const memberData = memberSnapshot.docs[0].data()
          setTeamInfo({
            teamName: memberData.teamName,
            teamLeadId: memberData.teamLeadId,
            joinedAt: memberData.joinedAt,
          })
        }
      } catch (error) {
        console.error("Error checking team membership:", error)
      }

      setUser(currentUserData)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleCodeSubmit = async () => {
    if (!inviteCode.trim()) {
      alert("Please enter a code")
      return
    }

    setIsSubmitting(true)
    try {
      const inviteQuery = query(
        collection(db, "team_invites"),
        where("code", "==", inviteCode.toUpperCase()),
        where("isActive", "==", true),
      )
      const inviteSnap = await getDocs(inviteQuery)

      if (inviteSnap.empty) {
        alert("❌ Invalid or expired invite code")
        setIsSubmitting(false)
        return
      }

      const inviteData = inviteSnap.docs[0].data()

      const existingMemberQuery = query(
        collection(db, "team_members"),
        where("uid", "==", user.uid),
        where("teamLeadId", "==", inviteData.teamLeadId),
      )
      const existingMemberSnap = await getDocs(existingMemberQuery)

      if (!existingMemberSnap.empty) {
        alert("❌ You are already a member of this team")
        setIsSubmitting(false)
        return
      }

      await addDoc(collection(db, "team_members"), {
        uid: user.uid,
        name: user.name,
        email: user.email,
        userType: "MEMBER",
        teamLeadId: inviteData.teamLeadId,
        teamLeadName: inviteData.teamLeadName,
        teamLeadEmail: inviteData.teamLeadEmail,
        teamName: inviteData.teamName,
        joinedAt: serverTimestamp(),
      })

      setTeamInfo({
        teamName: inviteData.teamName,
        teamLeadId: inviteData.teamLeadId,
        joinedAt: new Date(),
      })

      alert(`✅ Successfully joined ${inviteData.teamName}!`)
      setInviteCode("")
    } catch (error: any) {
      console.error("Error joining team:", error)
      alert("❌ Error joining team: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user || isLoading) {
    return (
      <div className="h-screen flex justify-center items-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl font-bold text-white">T</span>
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
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {teamInfo ? `${teamInfo.teamName}` : "Member Dashboard"}
                </h1>
                <p className="text-sm text-gray-600">Welcome back, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">Team Member</div>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!teamInfo ? (
          <div className="max-w-2xl mx-auto">
            {/* Welcome Section */}
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 relative">
                <Users className="w-10 h-10 text-white" />
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Join Your Team?</h2>
              <p className="text-xl text-gray-600 mb-8">
                Enter the invite code provided by your team lead to start collaborating
              </p>
            </div>

            {/* Join Team Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl"></div>

              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6">
                  <Key className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">Join Your Team</h3>
                <p className="text-gray-600 text-center mb-8">Enter the 6-character invite code to get started</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Invite Code</label>
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full px-6 py-4 border border-gray-200 rounded-2xl text-center font-mono text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      placeholder="XXXXXX"
                    />
                  </div>

                  <button
                    onClick={handleCodeSubmit}
                    disabled={isSubmitting || !inviteCode.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                        Joining Team...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Users className="w-5 h-5 mr-2" />
                        Join Team
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Features Preview */}
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/50 rounded-2xl backdrop-blur-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Real-time Chat</h3>
                <p className="text-sm text-gray-600">Communicate instantly with your team members</p>
              </div>
              <div className="text-center p-6 bg-white/50 rounded-2xl backdrop-blur-sm">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Team Events</h3>
                <p className="text-sm text-gray-600">Stay updated with team activities and deadlines</p>
              </div>
              <div className="text-center p-6 bg-white/50 rounded-2xl backdrop-blur-sm">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Collaboration</h3>
                <p className="text-sm text-gray-600">Work together seamlessly on projects</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Team Status Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-blue-50/50 rounded-3xl"></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Welcome to {teamInfo.teamName}!</h2>
                    <p className="text-gray-600">You're now part of the team and ready to collaborate</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Joined</div>
                    <div className="font-semibold text-gray-900">
                      {teamInfo.joinedAt?.toDate?.()?.toLocaleDateString() || "Today"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Team Events */}
              <div className="lg:col-span-1">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Team Events</h3>
                    </div>
                    <div className="text-sm text-gray-500">{events.length} events</div>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {events.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No events scheduled yet</p>
                        <p className="text-sm text-gray-400">Your team lead will add events here</p>
                      </div>
                    ) : (
                      events.map((event, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100"
                        >
                          <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                          <div className="text-sm text-purple-600 mb-2">{event.date}</div>
                          {event.description && <div className="text-sm text-gray-600">{event.description}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Section */}
              <div className="lg:col-span-2">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Team Chat</h3>
                  </div>

                  <FirestoreChat currentUser={user} roomId={teamInfo.teamLeadId} roomName={teamInfo.teamName} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/80 transition-all duration-300 cursor-pointer group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Send Message</h3>
                <p className="text-sm text-gray-600">Start a conversation with your team</p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/80 transition-all duration-300 cursor-pointer group">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">View Team</h3>
                <p className="text-sm text-gray-600">See all team members and their roles</p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/80 transition-all duration-300 cursor-pointer group">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Check Events</h3>
                <p className="text-sm text-gray-600">Stay updated with upcoming activities</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
