"use client";

import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

export default function Navbar() {
  const { isAuthenticated, user, logout, loading } = useAuth();

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            ReportWriter AI
          </Link>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : isAuthenticated ? (
              <>
                <span className="text-gray-700">
                  Hi, {user?.firstName}
                </span>
                <Link 
                  href="/image-editor" 
                  className="text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  Image Editor
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  Login
                </Link>
                <Link 
                  href="/login" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

