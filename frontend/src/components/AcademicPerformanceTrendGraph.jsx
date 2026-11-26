import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Award,
  BarChart3,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';

export const AcademicPerformanceTrendGraph = ({
  data,
  isLoading,
  error,
  retry,
}) => {
  const [activeView, setActiveView] = useState('both');
  const [showClassAverage, setShowClassAverage] = useState(true);
  const semesterRecords = data?.semesters || [];
  const assignmentRecords = data?.assignments || [];
  const kpis = data?.kpis || {};
  const distinction = kpis.distinction || {};
  const hasCohortData = assignmentRecords.length > 0
    && assignmentRecords.every((item) => item.classAveragePercent != null);
  const assignmentTypes = [...new Set(assignmentRecords.map((item) => item.type).filter(Boolean))];
  const typeLabels = {
    lab: 'Lab Reports',
    problemSet: 'Problem Sets',
    midterm: 'Midterms',
    quiz: 'Quizzes',
    assignment: 'Assignments',
  };
  const includedTypes = assignmentTypes.map((type) =>
    typeLabels[type] || type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
  );
  const gpaValues = semesterRecords.flatMap((item) => [item.sgpa, item.cgpa])
    .filter((value) => Number.isFinite(value));
  const gpaValuesWithCutoff = [...gpaValues, distinction.threshold]
    .filter((value) => Number.isFinite(value));
  const gpaMin = gpaValuesWithCutoff.length ? Math.min(...gpaValuesWithCutoff) : 0;
  const gpaMax = gpaValuesWithCutoff.length
    ? Math.max(...gpaValuesWithCutoff)
    : Number(kpis.gpaScale) || 1;
  const gpaPadding = Math.max((gpaMax - gpaMin) * 0.12, 0.05);
  const gpaDomain = [
    Math.max(0, Math.floor((gpaMin - gpaPadding) * 10) / 10),
    Math.ceil((gpaMax + gpaPadding) * 10) / 10,
  ];
  const scoreValues = assignmentRecords.flatMap((item) => [item.scorePercent, item.classAveragePercent])
    .filter((value) => Number.isFinite(value));
  const scoreValuesWithBenchmark = [...scoreValues, kpis.benchmarkPercent]
    .filter((value) => Number.isFinite(value));
  const scoreMin = scoreValuesWithBenchmark.length ? Math.min(...scoreValuesWithBenchmark) : 0;
  const scoreMax = scoreValuesWithBenchmark.length ? Math.max(...scoreValuesWithBenchmark) : 100;
  const scorePadding = Math.max((scoreMax - scoreMin) * 0.12, 5);
  const scoreDomain = [
    Math.max(0, Math.floor((scoreMin - scorePadding) / 5) * 5),
    Math.min(100, Math.ceil((scoreMax + scorePadding) / 5) * 5),
  ];

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4" aria-label="Loading academic performance">
        <div className="h-5 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-56 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5" role="alert">
        <p className="text-sm font-semibold text-slate-900">Unable to load academic performance</p>
        <p className="text-xs text-slate-600 mt-1">{error.message}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!semesterRecords.length && !assignmentRecords.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 text-sm text-slate-600">
        No academic performance data is available yet.
      </div>
    );
  }

  // Custom Tooltip for GPA Chart
  const CustomGpaTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[180px]">
          <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
            <span>{label}</span>
            {data.isCurrent && (
              <span className="bg-blue-600 text-[10px] px-1.5 py-0.5 rounded font-mono">Current</span>
            )}
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-blue-300">Semester SGPA:</span>
              <span className="font-bold text-white">
                {data.sgpa == null ? '—' : Number(data.sgpa).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Cumulative CGPA:</span>
              <span className="font-bold text-white">
                {data.cgpa == null ? '—' : Number(data.cgpa).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Credits Completed:</span>
              <span>{data.credits} cr</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Academic Year:</span>
              <span>{data.year}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Assignment Performance Chart
  const CustomAssignmentTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[210px]">
          <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
            <span className="truncate max-w-[150px]">{data.title}</span>
            <span className="text-[10px] text-slate-400 font-mono">{data.date}</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Your Score:</span>
              <span className="font-bold text-white">
                {data.scorePercent == null ? '—' : `${data.scorePercent}%`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cohort Average:</span>
              <span className="text-slate-300">
                {data.classAveragePercent == null ? 'Unavailable' : `${data.classAveragePercent}%`}
              </span>
            </div>
            {data.scorePercent != null && data.classAveragePercent != null && (
            <div className="flex items-center justify-between">
              <span className="text-blue-300">Delta vs Class:</span>
              {(() => {
                const delta = data.scorePercent - data.classAveragePercent;
                return (
                  <span className={`font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
            )}
            <div className="flex items-center justify-between text-slate-400 text-[10px] pt-1 border-t border-slate-800">
              <span>Weight: {data.weight}%</span>
              <span className={data.status === 'Graded' ? 'text-emerald-400' : 'text-amber-400'}>
                {data.status}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Academic Trend &amp; Performance Analytics
            </h2>
            <span className="text-[10px] sm:text-[11px] font-medium bg-blue-50 text-blue-800 px-1.5 sm:px-2 py-0.5 rounded border border-blue-200 shrink-0">
              Analytics
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Tracking longitudinal GPA growth progression and course assignment mastery over time
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveView('both')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'both'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Comparative</span>
            </span>
          </button>
          <button
            onClick={() => setActiveView('gpa')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'gpa'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GPA Growth
          </button>
          <button
            onClick={() => setActiveView('assignments')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'assignments'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assignments
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 my-4">
        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Cumulative CGPA</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
              {kpis.currentCgpa == null ? '—' : Number(kpis.currentCgpa).toFixed(2)}
            </span>
            {kpis.cgpaGrowth != null && (
              <span className={`text-[11px] sm:text-xs font-semibold flex items-center ${kpis.cgpaGrowth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                <ArrowUpRight className="w-3 h-3" />
                {kpis.cgpaGrowth > 0 ? '+' : ''}{Number(kpis.cgpaGrowth).toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Growth from first semester</div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Avg Assignment Score</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
              {kpis.avgAssignmentScore == null ? '—' : `${kpis.avgAssignmentScore}%`}
            </span>
            {kpis.topPercentLabel && (
              <span className="text-[11px] sm:text-xs font-semibold text-blue-700">{kpis.topPercentLabel}</span>
            )}
          </div>
          <div className={`text-[10px] sm:text-[11px] font-medium mt-0.5 truncate ${
            kpis.outperformanceDelta == null || kpis.outperformanceDelta >= 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {kpis.outperformanceDelta == null
              ? 'Cohort comparison unavailable'
              : `${kpis.outperformanceDelta > 0 ? '+' : ''}${Number(kpis.outperformanceDelta).toFixed(1)}% vs class avg`}
          </div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Distinction Target</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
              {distinction.threshold == null ? '—' : Number(distinction.threshold).toFixed(2)}
            </span>
            <span className={`text-[11px] sm:text-xs font-semibold ${distinction.achieved ? 'text-emerald-700' : 'text-amber-700'}`}>
              {distinction.achieved ? 'Achieved' : 'Not achieved'}
            </span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">{distinction.label || 'Distinction'}</div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Graded Deliverables</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{kpis.gradedCount ?? 0}</span>
            <span className="text-[11px] sm:text-xs text-slate-500">of {kpis.totalAssignments ?? assignmentRecords.length}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            {kpis.onTimePercent == null ? 'On-time rate unavailable' : `${kpis.onTimePercent}% on time`}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="space-y-4 sm:space-y-6 pt-2">
        {/* VIEW 1: GPA Growth Trajectory */}
        {(activeView === 'both' || activeView === 'gpa') && semesterRecords.length > 0 && (
          <div className="bg-slate-50/50 p-3 sm:p-4 border border-slate-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Semester GPA Progression ({data?.meta?.semesterRangeLabel || 'Selected semesters'})</span>
                </h3>
                <span className="text-[10px] sm:text-[11px] text-slate-500">
                  SGPA and Cumulative CGPA with {distinction.threshold == null
                    ? 'distinction'
                    : `${Number(distinction.threshold).toFixed(2)} ${distinction.label || 'distinction'}`} Threshold
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> SGPA
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> CGPA
                </span>
                <span className="flex items-center gap-1">
                  {distinction.threshold != null && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                      {Number(distinction.threshold).toFixed(2)} Cutoff
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={semesterRecords}
                  margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="cgpaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="sgpaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={gpaDomain}
                    tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomGpaTooltip />} />
                  {distinction.threshold != null && (
                    <ReferenceLine
                      y={distinction.threshold}
                      stroke="#d97706"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `${distinction.label || 'Distinction'} (${Number(distinction.threshold).toFixed(2)})`,
                        position: 'insideTopLeft',
                        fill: '#d97706',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="cgpa"
                    name="Cumulative CGPA"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#cgpaGradient)"
                    dot={{ r: 4, fill: '#059669', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#047857' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sgpa"
                    name="Semester SGPA"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#sgpaGradient)"
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#1d4ed8' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: Assignment Performance Over Time */}
        {(activeView === 'both' || activeView === 'assignments') && assignmentRecords.length > 0 && (
          <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Assignment Performance &amp; Deliverable Scores Over Time</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Individual coursework scores (%) benchmarked against semester cohort class average
                </span>
              </div>
              {hasCohortData && (
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={showClassAverage}
                      onChange={(e) => setShowClassAverage(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Show Cohort Average</span>
                  </label>
                </div>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={assignmentRecords}
                  margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={scoreDomain}
                    unit="%"
                    tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomAssignmentTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />
                  {kpis.benchmarkPercent != null && (
                    <ReferenceLine
                      y={kpis.benchmarkPercent}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{
                        value: `Target Benchmark (${kpis.benchmarkPercent}%)`,
                        position: 'insideBottomRight',
                        fill: '#64748b',
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Bar
                    dataKey="scorePercent"
                    name="Your Score (%)"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  {hasCohortData && showClassAverage && (
                    <Bar
                      dataKey="classAveragePercent"
                      name="Cohort Average (%)"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-2">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                {includedTypes.length ? `Includes ${includedTypes.join(', ')}` : 'Assignment types unavailable.'}
              </span>
              <span className={`font-mono font-semibold ${
                kpis.assignmentPercentile == null ? 'text-slate-500' : 'text-emerald-700'
              }`}>
                {kpis.assignmentPercentile == null
                  ? 'Cohort comparison unavailable'
                  : `Cohort Percentile: ${kpis.assignmentPercentile}%`}
              </span>
            </div>
            {!hasCohortData && (
              <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-200 pt-2">
                Cohort results are hidden because the available group does not meet the privacy threshold.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
