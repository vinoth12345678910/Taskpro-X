"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Users, MessageSquare, Shield, Zap, Star, Play, Menu, X } from "lucide-react"

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const features = [
    {
      icon: <Users className="w-8 h-8" />,
      title: "Team Management",
      description:
        "Effortlessly organize and manage your teams with role-based access control and intuitive member management.",
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Real-time Chat",
      description:
        "Stay connected with your team through instant messaging with real-time updates and seamless communication.",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure & Reliable",
      description:
        "Enterprise-grade security with Firebase authentication and encrypted data transmission for peace of mind.",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Fast",
      description:
        "Built with Next.js and optimized for performance, ensuring your team stays productive without delays.",
    },
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Product Manager",
      company: "TechCorp",
      content: "TaskProx has revolutionized how our team collaborates. The real-time features are game-changing.",
      rating: 5,
    },
    {
      name: "Michael Rodriguez",
      role: "Team Lead",
      company: "StartupXYZ",
      content: "The most intuitive team management tool we've ever used. Setup took minutes, not hours.",
      rating: 5,
    },
    {
      name: "Emily Johnson",
      role: "Operations Director",
      company: "GrowthCo",
      content: "Finally, a platform that scales with our team. The role-based access is exactly what we needed.",
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrollY > 50 ? "bg-white/95 backdrop-blur-md shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskProx
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">
                Features
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition-colors">
                Testimonials
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">
                Pricing
              </a>
              <Link href="/login" className="text-gray-600 hover:text-blue-600 transition-colors">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 py-4">
              <div className="flex flex-col space-y-4">
                <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Features
                </a>
                <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Testimonials
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Pricing
                </a>
                <Link href="/login" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <svg
            className="absolute top-10 left-10 w-20 h-20 text-blue-200 opacity-50"
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
            className="absolute top-32 right-20 w-16 h-16 text-purple-200 opacity-50"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg
            className="absolute bottom-20 left-1/4 w-12 h-12 text-blue-300 opacity-30"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-800 text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              Now with Real-time Collaboration
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Team Management
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Reimagined
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Streamline your team's workflow with TaskProx - the all-in-one platform for team management, real-time
              communication, and seamless collaboration. Built for modern teams who demand excellence.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                href="/signup"
                className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
                <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center mr-3 hover:shadow-xl transition-shadow">
                  <Play className="w-5 h-5 ml-1" />
                </div>
                Watch Demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">10K+</div>
                <div className="text-sm text-gray-600">Active Teams</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">99.9%</div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">4.9★</div>
                <div className="text-sm text-gray-600">User Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to manage your team</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to streamline your workflow and boost team productivity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Loved by teams worldwide</h2>
            <p className="text-xl text-gray-600">See what our customers have to say about TaskProx</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-shadow">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to transform your team management?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of teams already using TaskProx to streamline their workflow
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-white text-blue-600 px-8 py-4 rounded-full text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Start Your Free Trial
            </Link>
            <Link
              href="/login"
              className="border-2 border-white text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">T</span>
                </div>
                <span className="text-2xl font-bold">TaskProx</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                The ultimate team management platform for modern businesses. Streamline your workflow and boost
                productivity.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 TaskProx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
