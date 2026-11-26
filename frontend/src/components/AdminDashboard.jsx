import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { useAdminDashboard } from '../hooks/useAdminDashboard.js';
import { api } from '../services/api.js';

const domainStatusStyles = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  pending_verification: 'text-amber-700 bg-amber-50 border-amber-200',
  verifying: 'text-blue-700 bg-blue-50 border-blue-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
  disabled: 'text-slate-600 bg-slate-100 border-slate-200',
};

const domainStatusLabels = {
  active: 'Active',
  pending_verification: 'Pending verification',
  verifying: 'Verifying',
  failed: 'Failed',
  disabled: 'Disabled',
};

const sslStatusStyles = {
  active: 'text-emerald-700',
  provisioning: 'text-blue-700',
  failed: 'text-red-700',
  none: 'text-slate-600',
};

function getSslLabel(ssl) {
  if (!ssl) return 'No SSL certificate';
  if (ssl.status === 'active') {
    const protocol = ssl.protocol ? `${ssl.protocol} ` : '';
    const renewal = ssl.autoRenew ? ' (Auto-renewing)' : '';
    return `${protocol}Active${renewal}`;
  }
  if (ssl.status === 'provisioning') return 'Provisioning';
  if (ssl.status === 'failed') return 'Failed';
  return 'Not provisioned';
}

function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading admin dashboard">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="h-7 w-72 rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="h-56 rounded-lg border border-slate-200 bg-white p-5">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-6 space-y-4">
              <div className="h-3 rounded bg-slate-100" />
              <div className="h-3 rounded bg-slate-100" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}

export const AdminDashboard = ({
  currentUser,
  refreshKey = 0,
  onOpenDomainModal,
  onDashboardUpdated,
}) => {
  const { data, isLoading, error, retry } = useAdminDashboard(
    currentUser?.role === 'admin',
    refreshKey
  );
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [facultyError, setFacultyError] = useState('');
  const [busyCourseId, setBusyCourseId] = useState('');
  const [courseMutationError, setCourseMutationError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'admin') return undefined;
    let active = true;
    api.getAdminFaculty()
      .then((faculty) => {
        if (active) setFacultyOptions(faculty);
      })
      .catch((requestError) => {
        if (active) setFacultyError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  const updateCourseStatus = async (course, status) => {
    if (!status || status === course.status) return;
    setBusyCourseId(String(course._id || course.id));
    setCourseMutationError('');
    try {
      await api.updateAdminCourseStatus(course._id || course.id, status);
      onDashboardUpdated?.();
    } catch (requestError) {
      setCourseMutationError(requestError.message);
    } finally {
      setBusyCourseId('');
    }
  };

  const updateCourseFaculty = async (course, primaryFacultyId) => {
    const assigned = new Set((course.faculty || []).map((member) => member.id));
    if (primaryFacultyId) assigned.add(primaryFacultyId);
    else {
      const currentPrimary = course.faculty?.find((member) => member.role === 'primary');
      if (currentPrimary) assigned.delete(currentPrimary.id);
    }
    setBusyCourseId(String(course._id || course.id));
    setCourseMutationError('');
    try {
      await api.allotAdminCourseFaculty(course._id || course.id, {
        facultyIds: [...assigned],
        primaryFacultyId: primaryFacultyId || null,
      });
      onDashboardUpdated?.();
    } catch (requestError) {
      setCourseMutationError(requestError.message);
    } finally {
      setBusyCourseId('');
    }
  };

  if (isLoading) return <DashboardLoading />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Unable to load the admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { institution, domain, courses = [], stats, statusOptions = [] } = data;
  const domainStatus = domainStatusStyles[domain?.status] || domainStatusStyles.disabled;
  const sslStyle = sslStatusStyles[domain?.ssl?.status] || sslStatusStyles.none;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Institutional Administration Console
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {institution.name}{institution.city ? `, ${institution.city}` : ''} - Department of {institution.department.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenDomainModal}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
        >
          <Globe className="h-4 w-4" />
          Configure Custom Domain
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Globe className="h-4 w-4 text-blue-700" />
              <span>Custom Domain</span>
            </h2>
            {domain && (
              <span className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${domainStatus}`}>
                {domain.status === 'active' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {domainStatusLabels[domain.status] || domain.status}
              </span>
            )}
          </div>

          {domain ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
                <span className="text-slate-500">Domain URL:</span>
                <span className="break-all text-right font-mono font-bold text-slate-900">{domain.domain}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
                <span className="text-slate-500">DNS Record Type:</span>
                <span className="font-mono font-bold text-slate-900">{domain.recordType}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
                <span className="text-slate-500">Target Host:</span>
                <span className="break-all text-right font-mono text-slate-700">{domain.target}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="text-slate-500">SSL Certificate:</span>
                <span className={`text-right font-semibold ${sslStyle}`}>{getSslLabel(domain.ssl)}</span>
              </div>
              {domain.lastCheckedAt && (
                <p className="text-[11px] text-slate-500">
                  Last checked: {new Date(domain.lastCheckedAt).toLocaleString()}
                </p>
              )}
              {domain.lastError && (
                <p role="status" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">
                  {domain.lastError}
                </p>
              )}
              {domain.ssl?.issuer && (
                <p className="text-[11px] text-slate-500">Certificate issuer: {domain.ssl.issuer}</p>
              )}
            </div>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-800">No custom domain configured</p>
              <p className="mt-1 text-xs text-slate-500">Configure a domain to view its DNS and certificate status.</p>
              <button
                type="button"
                onClick={onOpenDomainModal}
                className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Configure domain
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenDomainModal}
            className="w-full rounded border border-slate-200 bg-slate-50 py-2 text-center text-xs font-semibold text-blue-800 transition-colors hover:bg-slate-100"
          >
            Manage DNS &amp; Domain Routing
          </button>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Building2 className="h-4 w-4 text-blue-700" />
              <span>Institution Affiliation</span>
            </h2>
            {institution.nirfBand && (
              <span className="text-xs text-slate-500">NIRF {institution.nirfBand} Band</span>
            )}
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-slate-600">
            <p>
              <strong className="text-slate-800">Institute:</strong>{' '}
              {institution.name}{institution.shortName ? ` (${institution.shortName})` : ''}{institution.city ? `, ${institution.city}` : ''}
            </p>
            <p>
              <strong className="text-slate-800">University Affiliation:</strong>{' '}
              {institution.affiliation.university}
              {institution.affiliation.short ? ` (${institution.affiliation.short})` : ''}
            </p>
            <p><strong className="text-slate-800">Department:</strong> {institution.department.name}</p>
            <p>
              <strong className="text-slate-800">Accreditations:</strong>{' '}
              {institution.accreditations.length ? institution.accreditations.join(', ') : 'None listed'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Department Course Offerings &amp; Faculty Allotment
          </h2>
          <p className="text-xs text-slate-500">
            {stats.totalCourses} courses · {stats.totalEnrolled} enrolled · {stats.unassignedCourses} unassigned
          </p>
        </div>

        {(courseMutationError || facultyError) && (
          <p role="alert" className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {courseMutationError || facultyError}
          </p>
        )}
        {courses.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Course Code</th>
                  <th className="px-3 py-2.5">Course Title</th>
                  <th className="px-3 py-2.5">Credits</th>
                  <th className="px-3 py-2.5">Faculty Instructor</th>
                  <th className="px-3 py-2.5">Enrolled Count</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {courses.map((course) => {
                  const statusColor = {
                    active: 'text-emerald-700',
                    inactive: 'text-slate-500',
                    archived: 'text-slate-500',
                    upcoming: 'text-blue-700',
                  }[course.status] || 'text-slate-600';
                  return (
                    <tr key={course._id || course.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-950">{course.code}</td>
                      <td className="px-3 py-2.5 text-slate-900">{course.name}</td>
                      <td className="px-3 py-2.5 font-mono">{course.credits}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{course.facultyName}</span>
                          <select
                            aria-label={`Change primary faculty for ${course.code}`}
                            value={course.faculty?.find((member) => member.role === 'primary')?.id || ''}
                            disabled={busyCourseId === String(course._id || course.id) || !facultyOptions.length}
                            onChange={(event) => updateCourseFaculty(course, event.target.value)}
                            className="max-w-40 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {facultyOptions.map((faculty) => (
                              <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono">{course.enrolledCount}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className={`font-semibold ${statusColor}`}>{course.statusLabel}</span>
                          <select
                            aria-label={`Change status for ${course.code}`}
                            value=""
                            disabled={busyCourseId === String(course._id || course.id)}
                            onChange={(event) => updateCourseStatus(course, event.target.value)}
                            className="max-w-40 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 disabled:opacity-50"
                          >
                            <option value="">Change status</option>
                            {statusOptions.map((option) => (
                              <option key={option.status} value={option.status}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No department courses are configured yet.
          </div>
        )}
      </div>
    </div>
  );
};
