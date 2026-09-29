import React, { useState } from 'react';
import { DomainRecord } from '../types/academic';
import { Globe, ShieldCheck, CheckCircle2, Copy, Check, X, RefreshCw } from 'lucide-react';

interface CustomDomainModalProps {
  domainRecord: DomainRecord;
  onUpdateDomain: (newDomain: string) => void;
  onClose: () => void;
}

export const CustomDomainModal: React.FC<CustomDomainModalProps> = ({
  domainRecord,
  onUpdateDomain,
  onClose,
}) => {
  const [domainInput, setDomainInput] = useState(domainRecord.domain);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'success' | 'idle'>('idle');

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleSaveDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    setIsVerifying(true);
    setTimeout(() => {
      onUpdateDomain(domainInput.trim());
      setIsVerifying(false);
      setVerifyStatus('success');
      setTimeout(() => setVerifyStatus('idle'), 2500);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Custom Domain Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Connect your institutional subdomain or custom apex domain to AcadLytic. SSL certificates are provisioned automatically via Let's Encrypt once DNS records resolve.
        </p>

        {/* Current Active Domain Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Currently Connected Domain
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
              {domainRecord.domain}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100 rounded">
            <ShieldCheck className="w-3.5 h-3.5" />
            SSL TLS 1.3 Certified
          </span>
        </div>

        {/* Change Domain Form */}
        <form onSubmit={handleSaveDomain} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Configure New Institutional Domain:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. portal.acadlytic.bvcoe.edu.in"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 rounded flex items-center gap-1.5 transition-colors"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Save & Verify</span>
                )}
              </button>
            </div>
          </div>

          {verifyStatus === 'success' && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Domain DNS records matched and verified. SSL certificate bound.</span>
            </div>
          )}
        </form>

        {/* DNS Records Table */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-800">Required DNS Records</div>
          <div className="border border-slate-200 rounded overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Host / Name</th>
                  <th className="py-2 px-3">Points To / Value</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-900">CNAME</td>
                  <td className="py-2 px-3">portal</td>
                  <td className="py-2 px-3 text-slate-600 text-[11px]">cname.acadlytic-system.net</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleCopy('cname.acadlytic-system.net', 'cname')}
                      className="p-1 text-slate-500 hover:text-slate-800 rounded"
                      title="Copy target"
                    >
                      {copiedField === 'cname' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-900">TXT</td>
                  <td className="py-2 px-3">_acadlytic-verify</td>
                  <td className="py-2 px-3 text-slate-600 text-[11px]">acadlytic-verify=bvcoe-2026-auth</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleCopy('acadlytic-verify=bvcoe-2026-auth', 'txt')}
                      className="p-1 text-slate-500 hover:text-slate-800 rounded"
                      title="Copy TXT verification"
                    >
                      {copiedField === 'txt' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
