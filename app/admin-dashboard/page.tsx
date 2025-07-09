"use client"
import { useEffect, useState } from "react"
import { auth } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import LogoutButton from "@/components/LogoutButton"
import { db } from "@/utils/firebase"
import { collection, getDocs } from "firebase/firestore"

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [teams, setTeams] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/login")
      } else {
        setUser(user)
        setIsLoading(false) // ✅ Add this line to stop loading
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const teamSnap = await getDocs(collection(db, "team_invites"))
      setTeams(teamSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      const userSnap = await getDocs(collection(db, "users"))
      setUsers(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      setLoading(false)
    }
    fetchData()
  }, [])

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-600 rounded-xl shadow-sm">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">TaskProx Admin</h1>
                <p className="text-xs text-red-600 font-medium">Administrator Panel</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Hello Admin,</span>{" "}
                <span className="text-gray-900 font-semibold">{localStorage.getItem("userName") || user.email}</span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area - Empty for now */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Teams List */}
            <div className="bg-white rounded shadow p-4">
              <h2 className="text-lg font-semibold mb-4">All Teams</h2>
              <ul className="space-y-3">
                {teams.length === 0 && <li className="text-gray-500">No teams found.</li>}
                {teams.map(team => (
                  <li key={team.id} className="border rounded p-3 bg-gray-50">
                    <div className="font-semibold">{team.teamName}</div>
                    <div className="text-sm text-gray-600">Lead: {team.teamLeadName} ({team.teamLeadEmail})</div>
                    <div className="text-xs text-gray-500">Invite Code: {team.code}</div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Users List */}
            <div className="bg-white rounded shadow p-4">
              <h2 className="text-lg font-semibold mb-4">All Users</h2>
              <ul className="space-y-3">
                {users.length === 0 && <li className="text-gray-500">No users found.</li>}
                {users.map(user => (
                  <li key={user.id} className="border rounded p-3 bg-gray-50">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    <div className="text-xs text-gray-500">Role: {user.userType}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
