import React from 'react';
import { FileText, X } from 'lucide-react';

export const TermsModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Terms and Conditions</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-1">
              Applicable Academic Year 2026-2027 | Bharati Vidyapeeth's College of Engineering
            </span>
            <p>
              By accessing and using AcadLytic, students, faculty, and administrative staff agree to adhere to the following Terms of Service, institutional statutes, and academic integrity policies.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">1. Academic Integrity and Submissions</h3>
            <p>
              All academic deliverables uploaded to the Assignment Tracker must represent the authentic, independent work of the submitting student. Plagiarism, unauthorized collaboration, or presenting third-party source code without proper citation will be reported to the College Disciplinary Committee.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">2. Acceptable Use of the Doubt Support System</h3>
            <p>
              The Doubt Support System is dedicated to academic inquiries, curriculum clarification, and technical debugging discussions. Users agree to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Maintain respectful, constructive, and professional discourse.</li>
              <li>Refrain from posting unverified exam question leakage or copyrighted textbook dumps.</li>
              <li>Provide clear context, attempted steps, and proper formatting when posting questions.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">3. GPA Prediction Engine Disclaimer</h3>
            <p>
              Calculations performed by the GPA Prediction Engine are predictive mathematical estimates based on current course credits and user-selected hypothetical grades. They do not constitute official transcript certifications. Final degree grades are ratified exclusively by the Examination Controller.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">4. Lecture Notes and Curriculum Intellectual Property</h3>
            <p>
              Course handouts, laboratory manuals, and lecture recordings distributed through the Lecture Calendar are the intellectual property of the respective faculty instructors and Bharati Vidyapeeth. External commercial republication is strictly prohibited.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">5. Account Security and Role Authentication</h3>
            <p>
              Users are responsible for safeguarding login credentials. Impersonating faculty members or modifying grading logs without authorization will result in immediate suspension of network privileges and formal institutional review.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600">
            <span className="font-semibold text-slate-900 block mb-0.5">Institutional Authority:</span>
            Office of the Principal & Head of Department (CSE), Bharati Vidyapeeth's College of Engineering, New Delhi.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            Agree & Close
          </button>
        </div>
      </div>
    </div>
  );
};
