import React from 'react';
import {
  Globe,
  Building2,
  CheckCircle2,
} from 'lucide-react';

export const AdminDashboard = ({
  currentUser,
  domainRecord,
  courses = [],
  onOpenDomainModal,
}) => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Institutional Administration Console
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bharati Vidyapeeth&apos;s College of Engineering, New Delhi - Department of Computer Science &amp; Engineering
          </p>
        </div>

        <button
          onClick={onOpenDomainModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
        >
          <Globe className="w-4 h-4" />
          Configure Custom Domain
        </button>
      </div>

      {/* Grid: Domain and Institutional Setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-700" />
              <span>Production Custom Domain</span>
            </h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Domain URL:</span>
              <span className="font-mono font-bold text-slate-900">{domainRecord?.domain || 'portal.acadlytic.bvcoe.edu.in'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">DNS Record Type:</span>
              <span className="font-mono font-bold text-slate-900">{domainRecord?.recordType || 'CNAME'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Target Host:</span>
              <span className="font-mono text-slate-700">{domainRecord?.target || 'cname.acadlytic-system.net'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">SSL Certificate:</span>
              <span className="text-emerald-700 font-semibold">TLS 1.3 Active (Auto-renewing)</span>
            </div>
          </div>

          <button
            onClick={onOpenDomainModal}
            className="w-full py-2 text-xs font-semibold text-blue-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors text-center"
          >
            Manage DNS &amp; Domain Routing
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>Institution Affiliation</span>
            </h2>
            <span className="text-xs text-slate-500">NIRF 201-300 Band</span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">Institute:</strong> Bharati Vidyapeeth&apos;s College of Engineering (BVCOE), New Delhi
            </p>
            <p>
              <strong className="text-slate-800">University Affiliation:</strong> Guru Gobind Singh Indraprastha University (GGSIPU)
            </p>
            <p>
              <strong className="text-slate-800">Department:</strong> Department of Computer Science &amp; Engineering
            </p>
            <p>
              <strong className="text-slate-800">Accreditations:</strong> AICTE Approved, NBA Accredited
            </p>
          </div>
        </div>
      </div>

      {/* Curriculum Course Directory */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900 mb-3">
          Department Course Offerings &amp; Faculty Allotment
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Course Code</th>
                <th className="py-2.5 px-3">Course Title</th>
                <th className="py-2.5 px-3">Credits</th>
                <th className="py-2.5 px-3">Faculty Instructor</th>
                <th className="py-2.5 px-3">Enrolled Count</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {courses.map((course) => (
                <tr key={course.code} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-950">{course.code}</td>
                  <td className="py-2.5 px-3 text-slate-900">{course.name}</td>
                  <td className="py-2.5 px-3 font-mono">{course.credits}</td>
                  <td className="py-2.5 px-3 text-slate-700">{course.facultyName}</td>
                  <td className="py-2.5 px-3 font-mono">64</td>
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 font-semibold">Active Curriculum</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
