import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CourseListPage from './pages/CourseListPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPage from './pages/LessonPage';
import AssignmentPage from './pages/AssignmentPage';
import InstructorAssignmentResultsPage from './pages/InstructorAssignmentResultsPage';
import CreateCoursePage from './pages/CreateCoursePage';
import InstructorCoursesPage from './pages/InstructorCoursesPage';
import InstructorManageCoursePage from './pages/InstructorManageCoursePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';
import PasswordResetPage from './pages/PasswordResetPage';
import ForgotPassword from './pages/ForgotPassword';
import MyCoursesPage from './pages/MyCoursesPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Default Redirect */}
              <Route path="/" element={<HomePage />} />

              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={(
                  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
                    <LoginPage />
                  </GoogleOAuthProvider>
                )}
              />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<PasswordResetPage />} />
              <Route
                path="/my-courses"
                element={(
                  <ProtectedRoute allowedRoles={['learner']}>
                    <MyCoursesPage />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/profile"
                element={(
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                )}
              />

              {/* Course Directory & Detail */}
              <Route path="/courses" element={<CourseListPage />} />
              <Route path="/courses/:id" element={<CourseDetailPage />} />
              <Route path="/courses/:id/lessons/:lessonId" element={<LessonPage />} />
              <Route path="/courses/:id/assignments/:assignmentId" element={<AssignmentPage />} />

              {/* Instructor Protected Routes */}
              <Route
                path="/instructor/courses"
                element={
                  <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                    <InstructorCoursesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/create"
                element={
                  <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                    <CreateCoursePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id/manage"
                element={
                  <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                    <InstructorManageCoursePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id/assignments/:assignmentId"
                element={
                  <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                    <InstructorAssignmentResultsPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Error Routes */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200/80 py-6 mt-12 text-center text-xs text-slate-400">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p>© {new Date().getFullYear()} LingoSphere LMS. All rights reserved.</p>
              <p className="flex items-center gap-1 font-medium text-slate-500">
                <span>Thiết kế cho</span>
                <span className="text-indigo-600 font-bold"> DATH-261 Group 12</span>
              </p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
