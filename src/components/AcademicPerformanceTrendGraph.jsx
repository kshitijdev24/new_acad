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
import { HISTORICAL_SEMESTER_RECORDS, HISTORICAL_ASSIGNMENT_PERFORMANCE } from '../data/performanceData.js';
import {
  TrendingUp,
  Award,
  BarChart3,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';

export const AcademicPerformanceTrendGraph = ({
  currentGpa,
  semesterRecords = HISTORICAL_SEMESTER_RECORDS,
  assignmentRecords = HISTORICAL_ASSIGNMENT_PERFORMANCE,
}) => {
  const [activeView, setActiveView] = useState('both');
  const [showClassAverage, setShowClassAverage] = useState(true);

  // Compute key performance statistics
  const firstSgpa = semesterRecords[0]?.sgpa ?? 3.35;
  const latestCgpa = parseFloat(currentGpa) || (semesterRecords[semesterRecords.length - 1]?.cgpa ?? 3.55);
  const gpaGrowth = (latestCgpa - firstSgpa).toFixed(2);

  const gradedAssignments = assignmentRecords.filter((a) => a.status === 'Graded');
  const avgAssignmentScore = gradedAssignments.length > 0
    ? (gradedAssignments.reduce((acc, a) => acc + a.scorePercent, 0) / gradedAssignments.length).toFixed(1)
    : '89.2';
  const avgCohortScore = gradedAssignments.length > 0
    ? (gradedAssignments.reduce((acc, a) => acc + a.classAveragePercent, 0) / gradedAssignments.length).toFixed(1)
    : '80.8';
  const outperformanceDelta = (parseFloat(avgAssignmentScore) - parseFloat(avgCohortScore)).toFixed(1);

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
              <span className="font-bold text-white">{data.sgpa.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Cumulative CGPA:</span>
              <span className="font-bold text-white">{data.cgpa.toFixed(2)}</span>
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
              <span className="font-bold text-white">{data.scorePercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cohort Average:</span>
              <span className="text-slate-300">{data.classAveragePercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-300">Delta vs Class:</span>
              <span className="font-bold text-emerald-400">
                +{(data.scorePercent - data.classAveragePercent).toFixed(1)}%
              </span>
            </div>
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
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{latestCgpa.toFixed(2)}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 flex items-center">
              <ArrowUpRight className="w-3 h-3" />+{gpaGrowth}
            </span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Growth from Sem 1</div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Avg Assignment Score</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{avgAssignmentScore}%</span>
            <span className="text-[11px] sm:text-xs font-semibold text-blue-700">Top 10%</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
            +{outperformanceDelta}% vs class avg
          </div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Distinction Target</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">3.50</span>
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700">Surpassed</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Dean&apos;s Honor Roll</div>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-semibold truncate">Graded Deliverables</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{gradedAssignments.length}</span>
            <span className="text-[11px] sm:text-xs text-slate-500">of {assignmentRecords.length}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">100% timely</div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="space-y-4 sm:space-y-6 pt-2">
        {/* VIEW 1: GPA Growth Trajectory */}
        {(activeView === 'both' || activeView === 'gpa') && (
          <div className="bg-slate-50/50 p-3 sm:p-4 border border-slate-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Semester GPA Progression (Sem 1 to Sem 5)</span>
                </h3>
                <span className="text-[10px] sm:text-[11px] text-slate-500">
                  SGPA and Cumulative CGPA with 3.50 Distinction Threshold
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
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" /> 3.50 Cutoff
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
                    domain={[3.0, 4.0]}
                    ticks={[3.0, 3.2, 3.4, 3.5, 3.6, 3.8, 4.0]}
                    tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomGpaTooltip />} />
                  <ReferenceLine
                    y={3.5}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: "Dean's Honor (3.50)",
                      position: 'insideTopLeft',
                      fill: '#d97706',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
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
        {(activeView === 'both' || activeView === 'assignments') && (
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
                    domain={[60, 100]}
                    ticks={[60, 70, 80, 90, 100]}
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
                  <ReferenceLine
                    y={80}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Target Benchmark (80%)',
                      position: 'insideBottomRight',
                      fill: '#64748b',
                      fontSize: 10,
                    }}
                  />
                  <Bar
                    dataKey="scorePercent"
                    name="Your Score (%)"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  {showClassAverage && (
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
                Data includes Lab Reports, Chapter Problem Sets, and Theory Midterm evaluations.
              </span>
              <span className="font-mono text-emerald-700 font-semibold">
                Cohort Percentile: 92nd Percentile
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
