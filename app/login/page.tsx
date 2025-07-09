"use client"
import { signInWithEmailAndPassword } from "firebase/auth"
import type React from "react"

import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from "lucide-react"

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      alert("Please fill in all fields")
      return
    }

    setIsLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password)
      const uid = userCredential.user.uid

      const userDocRef = doc(db, "users", uid)
      const userDocSnap = await getDoc(userDocRef)

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data()
        const role = userData.role
        const email = userData.email

        localStorage.setItem("userName", userData.name)
        localStorage.setItem("userEmail", email)
        localStorage.setItem("userRole", role)

        if (role === "admin") {
          router.push("/admin-dashboard")
        } else if (role === "team_lead") {
          router.push("/teamlead-dashboard")
        } else {
          router.push("/member-dashboard")
        }
      } else {
        alert("User data not found!")
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute top-10 left-10 w-32 h-32 text-blue-200 opacity-30"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <svg
          className="absolute bottom-10 right-10 w-24 h-24 text-purple-200 opacity-30"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-purple-400 rounded-full animate-pulse delay-1000"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo Section */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">T</span>
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Welcome back to
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              TaskProx
            </span>
          </h2>
          <p className="text-gray-600 text-lg">Sign in to continue your journey</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl py-10 px-8 shadow-2xl sm:rounded-3xl border border-white/20 relative overflow-hidden">
          {/* Glassmorphism effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl"></div>

          <div className="relative">
            <form className="space-y-6">
              {/* Email */}
              <div className="group">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-3">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="block w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="block w-full pl-12 pr-14 py-4 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoading || !formData.email || !formData.password}
                  className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Signing In...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      Sign In to TaskProx
                      <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-500 rounded-full">New to TaskProx?</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/signup"
                  className="font-semibold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                >
                  Create your account and get started →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
