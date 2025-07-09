"use client"
import { signOut } from "firebase/auth"
import { auth } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
    >
      <LogOut className="w-4 h-4 mr-2" />
      Sign Out
    </button>
  )
}
