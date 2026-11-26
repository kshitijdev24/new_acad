import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Globe,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';

const statusClassNames = {
  active: 'bg-emerald-100 text-emerald-800',
  pending_verification: 'bg-amber-100 text-amber-800',
  verifying: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  disabled: 'bg-slate-100 text-slate-700',
};

const statusLabels = {
  active: 'Active',
  pending_verification: 'Pending verification',
  verifying: 'Verifying',
  failed: 'Failed',
  disabled: 'Disabled',
};

export const CustomDomainModal = ({ onClose, onChanged }) => {
  const [domain, setDomain] = useState(null);
  const [domainInput, setDomainInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    let active = true;
    api.getAdminDomain()
      .then((result) => {
        if (active) {
          setDomain(result);
          setDomainInput(result?.domain || '');
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dnsRecords = useMemo(() => {
    if (!domain) return [];
    return [
      { type: domain.recordType, host: domain.domain, value: domain.target, key: 'cname' },
      {
        type: domain.verification.type,
        host: domain.verification.host,
        value: domain.verification.value,
        key: 'txt',
      },
    ];
  }, [domain]);

  const runAction = async (name, callback, successMessage) => {
    setAction(name);
    setError('');
    setMessage('');
    try {
      const result = await callback();
      if (Array.isArray(result?.dnsRecords)) {
        setDomain(result.domain);
        if (result.domain) setDomainInput(result.domain.domain);
      } else {
        setDomain(result);
      }
      if (result && !Array.isArray(result?.dnsRecords)) setDomainInput(result.domain);
      setMessage(successMessage(result));
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAction('');
    }
  };

  const handleCreateDomain = (event) => {
    event.preventDefault();
    const trimmed = domainInput.trim();
    if (!trimmed) return;
    runAction(
      'create',
      () => api.createAdminDomain(trimmed),
      () => 'Domain saved. Create both DNS records below, then select Verify now.'
    );
  };

  const handleVerify = () => runAction(
    'verify',
    () => api.verifyAdminDomain(),
    (result) => result.status === 'active'
      ? 'DNS records verified successfully.'
      : (result.lastError || 'DNS verification did not pass. Update the DNS records and retry.')
  );

  const handleProvisionSsl = () => runAction(
    'ssl',
    () => api.provisionAdminSsl(),
    (result) => result.ssl?.status === 'active'
      ? 'SSL certificate is active.'
      : 'SSL certificate provisioning has started.'
  );

  const handleDeleteDomain = async () => {
    if (!window.confirm('Disable and release this custom domain?')) return;
    setAction('delete');
    setError('');
    setMessage('');
    try {
      await api.deleteAdminDomain();
      setDomain(null);
      setDomainInput('');
      setMessage('Domain disabled and released. You can now configure another domain.');
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAction('');
    }
  };

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 1500);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  const sslLabel = domain?.ssl?.status === 'active'
    ? `${domain.ssl.protocol || 'SSL'} Active${domain.ssl.autoRenew ? ' (Auto-renewing)' : ''}`
    : domain?.ssl?.status === 'provisioning'
      ? 'Provisioning'
      : domain?.ssl?.status === 'failed'
        ? 'Failed'
        : 'Not provisioned';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-lg border border-slate-300 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Custom Domain Configuration</h2>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          Configure your institution’s hostname, create the DNS records shown below, and verify ownership before the domain is activated.
        </p>

        {isLoading ? (
          <div className="animate-pulse space-y-3 rounded border border-slate-200 p-4" aria-label="Loading domain">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-3 rounded bg-slate-100" />
            <div className="h-3 w-3/4 rounded bg-slate-100" />
          </div>
        ) : domain ? (
          <div className="flex flex-col justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Configured Domain
              </div>
              <div className="mt-0.5 truncate font-mono text-sm font-bold text-slate-900">{domain.domain}</div>
              <div className="mt-1 text-xs text-slate-600">SSL: {sslLabel}</div>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 self-start rounded px-2.5 py-1 text-xs font-semibold sm:self-auto ${statusClassNames[domain.status] || statusClassNames.disabled}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {statusLabels[domain.status] || domain.status}
            </span>
          </div>
        ) : null}

        {!isLoading && !domain && (
          <form onSubmit={handleCreateDomain} className="space-y-3 rounded border border-slate-200 p-3">
            <label htmlFor="custom-domain" className="block text-xs font-semibold text-slate-800">
              Institutional hostname
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="custom-domain"
                type="text"
                required
                maxLength={253}
                placeholder="portal.college.edu.in"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
              <button
                type="submit"
                disabled={Boolean(action)}
                className="flex items-center justify-center gap-1.5 rounded bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:bg-blue-300"
              >
                {action === 'create' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                Save domain
              </button>
            </div>
          </form>
        )}

        {domain && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-800">Required DNS Records</div>
                <button
                  type="button"
                  disabled={Boolean(action)}
                  onClick={handleVerify}
                  className="inline-flex items-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
                >
                  {action === 'verify' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  Verify now
                </button>
              </div>
              <div className="overflow-x-auto rounded border border-slate-200 text-xs">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Host / Name</th>
                      <th className="px-3 py-2">Points To / Value</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {dnsRecords.map((record) => (
                      <tr key={record.key}>
                        <td className="px-3 py-2 font-bold text-blue-900">{record.type}</td>
                        <td className="break-all px-3 py-2">{record.host}</td>
                        <td className="break-all px-3 py-2 text-slate-600">{record.value}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopy(record.value, record.key)}
                            className="rounded p-1 text-slate-500 hover:text-slate-800"
                            title={`Copy ${record.type} value`}
                          >
                            {copiedField === record.key
                              ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(record.host, `${record.key}-host`)}
                            className="ml-1 rounded p-1 text-slate-500 hover:text-slate-800"
                            title={`Copy ${record.type} host`}
                          >
                            {copiedField === `${record.key}-host`
                              ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {domain.status === 'active' && domain.ssl?.status !== 'active' && (
              <button
                type="button"
                disabled={Boolean(action)}
                onClick={handleProvisionSsl}
                className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              >
                {action === 'ssl' ? 'Provisioning SSL...' : 'Provision SSL certificate'}
              </button>
            )}
            {domain.lastError && (
              <p role="alert" className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
                {domain.lastError}
              </p>
            )}
            {domain.status === 'active' && domain.ssl?.status === 'active' && (
              <p className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                {sslLabel}
              </p>
            )}
            <div className="flex justify-end border-t border-slate-200 pt-2">
              <button
                type="button"
                disabled={Boolean(action)}
                onClick={handleDeleteDomain}
                className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
              >
                {action === 'delete' ? 'Releasing...' : 'Disable and release domain'}
              </button>
            </div>
          </>
        )}

        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">{error}</p>}
        {message && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">{message}</p>}

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
