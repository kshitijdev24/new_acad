import React, { useState } from 'react';
import { INITIAL_STUDENT_USER, INITIAL_FACULTY_USER, INITIAL_ADMIN_USER } from '../data/mockData.js';
import { X } from 'lucide-react';

export const AuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('tanyawadhwaa12@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('Kshitij Jaiswal');
  const [enrollment, setEnrollment] = useState('09511502722');

  if (!isOpen) return null;

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'student') {
      setEmail('student@example.com');
      setName('Kshitij Jaiswal');
    } else if (role === 'faculty') {
      setEmail('faculty@example.com');
      setName('Ms. Deepika Yadav');
    } else {
      setEmail('admin@example.com');
      setName('Dr. Deepika Kumar');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedRole === 'student') {
      onLoginSuccess({
        ...INITIAL_STUDENT_USER,
        name: isSignUp ? name : 'Kshitij Jaiswal',
        email: email || INITIAL_STUDENT_USER.email,
        enrollmentNumber: enrollment || INITIAL_STUDENT_USER.enrollmentNumber,
      });
    } else if (selectedRole === 'faculty') {
      onLoginSuccess({
        ...INITIAL_FACULTY_USER,
        name: isSignUp ? name : INITIAL_FACULTY_USER.name,
        email: email || INITIAL_FACULTY_USER.email,
      });
    } else {
      onLoginSuccess({
        ...INITIAL_ADMIN_USER,
        name: isSignUp ? name : INITIAL_ADMIN_USER.name,
        email: email || INITIAL_ADMIN_USER.email,
      });
    }
    onClose();
  };

  const handleGuestLogin = () => {
    if (selectedRole === 'student') {
      onLoginSuccess(INITIAL_STUDENT_USER);
    } else if (selectedRole === 'faculty') {
      onLoginSuccess(INITIAL_FACULTY_USER);
    } else {
      onLoginSuccess(INITIAL_ADMIN_USER);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center relative">
          <button
            onClick={onClose}
            className="absolute top-0 right-0 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-extrabold text-blue-900 tracking-tight">
            AcadLytic
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Academic Management System
          </p>
        </div>

        {/* Role Segmented Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => handleRoleSelect('student')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
              selectedRole === 'student'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('admin')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
              selectedRole === 'admin'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('faculty')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
              selectedRole === 'faculty'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Faculty
          </button>
        </div>

        {/* Form Title */}
        <div className="text-center font-bold text-sm text-slate-900">
          {isSignUp ? `Register as ${selectedRole.toUpperCase()}` : `Login as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSignUp && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
            </div>
          )}

          {isSignUp && selectedRole === 'student' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Enrollment Number
              </label>
              <input
                type="text"
                required
                value={enrollment}
                onChange={(e) => setEnrollment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 font-bold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors text-xs"
          >
            {isSignUp ? 'Create Account' : 'Login'}
          </button>
        </form>

        {/* Divider: or */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-slate-400 text-xs">or</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Guest Login Button */}
        <button
          onClick={handleGuestLogin}
          className="w-full py-2.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors text-xs"
        >
          Enter as Guest {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
        </button>

        {/* Sign up toggle */}
        <div className="text-center text-xs text-slate-600">
          {isSignUp ? 'Already registered? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-700 font-semibold hover:underline"
          >
            {isSignUp ? 'Login' : 'Sign Up'}
          </button>
        </div>

        {/* Demo Credentials Box */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
          <div className="font-bold text-slate-800">Demo Credentials:</div>
          <div className="font-mono text-[11px] text-slate-600">
            Email: <span className="font-semibold">{selectedRole}@example.com</span>
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            Password: <span className="font-semibold">password</span>
          </div>
        </div>
      </div>
    </div>
  );
};
