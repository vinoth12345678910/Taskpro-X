"use client"
import { useState } from "react"
import type React from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/utils/firebase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, Crown, Sparkles, UserCheck } from "lucide-react"

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSignup = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill in all fields")
      return
    }

    setIsLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      const uid = userCredential.user.uid

      const assignedRole = formData.email === "va3490@srmist.edu.in" ? "admin" : formData.role

      await setDoc(doc(db, "users", uid), {
        name: formData.name,
        email: formData.email,
        role: assignedRole,
        createdAt: serverTimestamp(),
      })

      if (assignedRole === "admin") {
        router.push("/admin-dashboard")
      } else if (assignedRole === "team_lead") {
        router.push("/teamlead-dashboard")
      } else {
        router.push("/member-dashboard")
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const isAdminEmail = formData.email === "va3490@srmist.edu.in"

  const roleOptions = [
    {
      value: "member",
      label: "Team Member",
      icon: <User className="w-5 h-5" />,
      description: "Join teams and collaborate on projects",
    },
    {
      value: "team_lead",
      label: "Team Lead",
      icon: <UserCheck className="w-5 h-5" />,
      description: "Create and manage teams",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute top-20 left-20 w-28 h-28 text-blue-200 opacity-20"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
            clipRule="evenodd"
          />
        </svg>
        <svg
          className="absolute bottom-20 right-20 w-32 h-32 text-purple-200 opacity-20"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
        </svg>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="absolute bottom-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-500"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        {/* Logo Section */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">T</span>
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Join
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              TaskProx Today
            </span>
          </h2>
          <p className="text-gray-600 text-lg">Create your account and start collaborating</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-white/80 backdrop-blur-xl py-10 px-8 shadow-2xl sm:rounded-3xl border border-white/20 relative overflow-hidden">
          {/* Glassmorphism effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl"></div>

          <div className="relative">
            {/* Admin Notice */}
            {isAdminEmail && (
              <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-100/50 to-pink-100/50"></div>
                <div className="relative flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-800 text-lg">Administrator Access Granted</p>
                    <p className="text-sm text-red-600">You will receive full administrative privileges</p>
                  </div>
                </div>
              </div>
            )}

            <form className="space-y-6">
              {/* Full Name */}
              <div className="group">
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-3">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="block w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

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
                    placeholder="Create a strong password"
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
                <p className="mt-2 text-xs text-gray-500">Must be at least 6 characters long</p>
              </div>

              {/* Role Selection */}
              {!isAdminEmail ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Choose Your Role</label>
                  <div className="grid grid-cols-1 gap-3">
                    {roleOptions.map((option) => (
                      <label key={option.value} className="relative">
                        <input
                          type="radio"
                          name="role"
                          value={option.value}
                          checked={formData.role === option.value}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <div
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                            formData.role === option.value
                              ? "border-blue-500 bg-blue-50 shadow-lg"
                              : "border-gray-200 bg-white/50 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${
                                formData.role === option.value ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {option.icon}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{option.label}</div>
                              <div className="text-sm text-gray-600">{option.description}</div>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Assigned Role</label>
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-red-800">Administrator</div>
                        <div className="text-sm text-red-600">Full system access and control</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={isLoading || !formData.name || !formData.email || !formData.password}
                  className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Creating Account...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {isAdminEmail ? "Create Admin Account" : "Create Account"}
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
                  <span className="px-4 bg-white/80 text-gray-500 rounded-full">Already have an account?</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="font-semibold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                >
                  Sign in to your account →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
