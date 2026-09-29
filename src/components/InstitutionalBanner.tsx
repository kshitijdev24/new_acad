import React from 'react';
import { Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UserProfile, DomainRecord } from '../types/academic';

interface InstitutionalBannerProps {
  currentUser: UserProfile;
  domainRecord: DomainRecord;
  onOpenDomainSettings: () => void;
}

export const InstitutionalBanner: React.FC<InstitutionalBannerProps> = ({
  currentUser,
  domainRecord,
  onOpenDomainSettings,
}) => {
  return (
    <div className="bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-100">
              Bharati Vidyapeeth's College of Engineering (BVCOE), New Delhi
            </span>
            <span className="text-slate-400 hidden sm:inline">|</span>
            <span className="text-slate-300 hidden sm:inline">
              Department of Computer Science and Engineering
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-300">
            <button
              onClick={onOpenDomainSettings}
              className="flex items-center gap-1.5 hover:text-white transition-colors text-left"
              title="Click to view DNS and custom domain SSL configuration"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] text-blue-200 underline decoration-slate-600 underline-offset-2">
                {domainRecord.domain}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 inline" /> SSL Active
              </span>
            </button>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">
              Semester {currentUser.semester} (Odd Session 2026)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
