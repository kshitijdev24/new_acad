import React from 'react';
import { Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const InstitutionalBanner = ({
  currentUser,
  domainRecord,
  onOpenDomainSettings,
}) => {
  return (
    <div className="bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-100 truncate">
              Bharati Vidyapeeth&apos;s College of Engineering (BVCOE), New Delhi
            </span>
            <span className="text-slate-400 hidden lg:inline">|</span>
            <span className="text-slate-300 hidden lg:inline">
              Department of Computer Science and Engineering
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-300 text-[10px] sm:text-xs">
            <button
              onClick={onOpenDomainSettings}
              className="flex items-center gap-1.5 hover:text-white transition-colors text-left cursor-pointer"
              title="Click to view DNS and custom domain SSL configuration"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-[10px] sm:text-[11px] text-blue-200 underline decoration-slate-600 underline-offset-2">
                {domainRecord?.domain || 'portal.acadlytic.bvcoe.edu.in'}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 inline" /> SSL Active
              </span>
            </button>
            <span className="text-slate-500 hidden xs:inline">·</span>
            <span className="text-slate-300">
              Semester {currentUser?.semester || 5} (Odd Session 2026)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
