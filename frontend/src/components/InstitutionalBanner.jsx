import React, { useEffect, useState } from 'react';
import { Building2, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';

export const InstitutionalBanner = ({
  currentUser,
  onOpenDomainSettings,
  refreshKey = 0,
}) => {
  const [domainRecord, setDomainRecord] = useState(null);
  const [domainLoadFailed, setDomainLoadFailed] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setDomainRecord(null);
      setDomainLoadFailed(false);
      return undefined;
    }

    let active = true;
    api.getAdminDomain()
      .then((domain) => {
        if (active) {
          setDomainRecord(domain);
          setDomainLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setDomainRecord(null);
          setDomainLoadFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [currentUser?.role, refreshKey]);

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-100 truncate">
              {currentUser?.institution || 'Acadlytic'}
            </span>
            {currentUser?.department && (
              <>
                <span className="hidden text-slate-400 lg:inline">|</span>
                <span className="hidden text-slate-300 lg:inline">{currentUser.department}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-300 text-[10px] sm:text-xs">
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={onOpenDomainSettings}
                className="flex cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-white"
                title="View DNS and custom domain certificate status"
              >
                {domainRecord?.ssl?.status === 'active'
                  ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  : <Globe className="h-3.5 w-3.5 shrink-0 text-blue-300" />}
                <span className="font-mono text-[10px] text-blue-200 underline decoration-slate-600 underline-offset-2 sm:text-[11px]">
                  {domainLoadFailed
                    ? 'Domain status unavailable'
                    : domainRecord?.domain || 'Configure custom domain'}
                </span>
                {domainRecord?.ssl?.status === 'active' && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
                    <CheckCircle2 className="inline h-3 w-3" />
                    {domainRecord.ssl.protocol || 'SSL Active'}
                  </span>
                )}
              </button>
            )}
            <span className="text-slate-500 hidden xs:inline">·</span>
            {currentUser?.semester && <span className="text-slate-300">Semester {currentUser.semester}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
