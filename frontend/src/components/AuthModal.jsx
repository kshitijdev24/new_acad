import React, { useState } from 'react';
import { GUEST_STUDENT_USER } from '../data/mockData.js';
import { api } from '../services/api.js';
import { X } from 'lucide-react';

export const AuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role !== 'student') setIsSignUp(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = isSignUp
        ? await api.registerCandidate({ name, email, password, enrollmentNumber: enrollment })
        : await api.login({ email, password });

      if (user.role !== selectedRole) {
        await api.logout();
        throw new Error(`This account is not registered as ${selectedRole}.`);
      }

      onLoginSuccess(user);
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Unable to authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await api.logout();
      onLoginSuccess(GUEST_STUDENT_USER);
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Unable to switch to guest access.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="text-center relative">
          <button
            onClick={onClose}
            className="absolute top-0 right-0 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                minLength={2}
                maxLength={100}
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
                maxLength={40}
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
              autoComplete="email"
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
              minLength={isSignUp ? 8 : undefined}
              maxLength={128}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-700"
            />
          </div>

          {error && (
            <p role="alert" className="text-red-700 text-xs">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded transition-colors text-xs"
          >
            {isSubmitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Login'}
          </button>
        </form>

        {selectedRole === 'student' && (
          <>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-xs">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isSubmitting}
              className="w-full py-2.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors text-xs"
            >
              Enter as Guest Student
            </button>
          </>
        )}

        {selectedRole === 'student' && (
          <div className="text-center text-xs text-slate-600">
            {isSignUp ? 'Already registered? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-blue-700 font-semibold hover:underline"
            >
              {isSignUp ? 'Login' : 'Sign Up'}
            </button>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
          <div className="font-bold text-slate-800">Account access</div>
          <div className="text-[11px]">
            {selectedRole === 'student'
              ? 'Create a student account or continue with the limited guest demo.'
              : 'Faculty and admin accounts must be provisioned by an administrator.'}
          </div>
        </div>
      </div>
    </div>
  );
};
