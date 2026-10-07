import React from 'react';
import { Shield, X } from 'lucide-react';

export const PrivacyPolicyModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Privacy Policy</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-1">
              Effective Date: Academic Session 2026-2027 | Version 1.4
            </span>
            <p>
              This Privacy Policy outlines how the AcadLytic Academic Management System, deployed at Bharati Vidyapeeth's College of Engineering (BVCOE), New Delhi, collects, processes, and safeguards student, faculty, and administrative educational records.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">1. Information We Collect</h3>
            <p>
              AcadLytic processes information necessary to maintain academic continuity, calculate predictive GPA projections, and facilitate faculty-student interactions:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Institutional Identity: Student name, enrollment number (e.g. 09511502722), university email address, and departmental affiliation.</li>
              <li>Academic Performance Records: Course enrollments, internal assessment marks, laboratory reports, attendance percentages, and GPA historical trends.</li>
              <li>Deliverable Submissions: Assignment files, project code repositories, timestamped submissions, and evaluative feedback from instructors.</li>
              <li>Mentoring Interactions: Queries posted in the Doubt Support System, faculty replies, and discussion comments.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">2. Educational Use and Purpose</h3>
            <p>
              Collected data is utilized strictly for institutional operations:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Continuous evaluation and semester grade computation.</li>
              <li>Providing real-time scenario predictions in the GPA Prediction Engine.</li>
              <li>Verifying mandatory attendance compliance (minimum 75% threshold under University regulations).</li>
              <li>Delivering contextual academic notices and examination schedules.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">3. Zero Third-Party Advertising and Commercial Profiling</h3>
            <p>
              AcadLytic does not sell, license, or monetize student or faculty data. No third-party commercial trackers, behavioral analytics, or marketing pixels are embedded in this platform.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">4. Data Security and Infrastructure</h3>
            <p>
              All data transmitted between user web browsers and the AcadLytic platform is encrypted using Transport Layer Security (TLS 1.3). Access to student records is governed by role-based access control (RBAC), restricting administrative modifications to authorized faculty and department heads.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">5. Data Retention and Student Rights</h3>
            <p>
              Academic records are retained in compliance with university archival rules. Students hold the right to inspect their recorded attendance logs and request verification of any clerical discrepancies through the Head of Department.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600">
            <span className="font-semibold text-slate-900 block mb-0.5">Academic Data Controller:</span>
            Department of Computer Science & Engineering, Bharati Vidyapeeth's College of Engineering, A-4 Paschim Vihar, New Delhi - 110063.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
