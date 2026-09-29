import React from 'react';
import { Shield, FileText, Globe, Building2 } from 'lucide-react';
import { DomainRecord } from '../types/academic';

interface FooterProps {
  domainRecord: DomainRecord;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenDomainModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  domainRecord,
  onOpenPrivacy,
  onOpenTerms,
  onOpenDomainModal,
}) => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-900">
              AcadLytic - Academics Meet Analytics
            </div>
            <p className="text-slate-500 mt-0.5">
              Developed by Kshitij Jaiswal (09511502722) under guidance of Ms. Deepika Yadav.
            </p>
            <p className="text-slate-500">
              Department of Computer Science & Engineering, Bharati Vidyapeeth's College of Engineering (BVCOE), New Delhi - 110063.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <button
              onClick={onOpenPrivacy}
              className="text-slate-600 hover:text-blue-900 transition-colors flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={onOpenTerms}
              className="text-slate-600 hover:text-blue-900 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms & Conditions</span>
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={onOpenDomainModal}
              className="text-slate-600 hover:text-blue-900 transition-colors flex items-center gap-1 font-mono text-[11px]"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{domainRecord.domain}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-[11px] text-slate-400 gap-2">
          <div>
            (c) 2026 AcadLytic Academic System. Bharati Vidyapeeth's College of Engineering. All rights reserved.
          </div>
          <div>
            Affiliated to Guru Gobind Singh Indraprastha University (GGSIPU), New Delhi.
          </div>
        </div>
      </div>
    </footer>
  );
};
