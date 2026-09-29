import React, { useState, useMemo } from 'react';
import { GRADE_POINTS } from '../data/mockData.js';
import { RotateCcw, TrendingUp, Target, Calculator, CheckCircle2 } from 'lucide-react';

export const GpaPredictionEngine = ({ courses = [] }) => {
  const [predictedGrades, setPredictedGrades] = useState(() => {
    const initial = {};
    (courses || []).forEach((c) => {
      initial[c.code] = c.currentGrade;
    });
    return initial;
  });

  const [targetGpaInput, setTargetGpaInput] = useState('3.70');
  const [showTargetSolver, setShowTargetSolver] = useState(false);

  // Total credits
  const totalCredits = useMemo(() => {
    return (courses || []).reduce((sum, c) => sum + c.credits, 0);
  }, [courses]);

  // Current GPA
  const currentGpa = useMemo(() => {
    if (totalCredits === 0) return 0;
    const points = (courses || []).reduce((sum, c) => {
      const gp = GRADE_POINTS[c.currentGrade] ?? 3.0;
      return sum + gp * c.credits;
    }, 0);
    return Number((points / totalCredits).toFixed(2));
  }, [courses, totalCredits]);

  // Predicted GPA
  const predictedGpa = useMemo(() => {
    if (totalCredits === 0) return 0;
    const points = (courses || []).reduce((sum, c) => {
      const letter = predictedGrades[c.code] ?? c.currentGrade;
      const gp = GRADE_POINTS[letter] ?? 3.0;
      return sum + gp * c.credits;
    }, 0);
    return Number((points / totalCredits).toFixed(2));
  }, [courses, predictedGrades, totalCredits]);

  const handleGradeChange = (code, newGrade) => {
    setPredictedGrades((prev) => ({
      ...prev,
      [code]: newGrade,
    }));
  };

  const handleReset = () => {
    const reset = {};
    (courses || []).forEach((c) => {
      reset[c.code] = c.currentGrade;
    });
    setPredictedGrades(reset);
  };

  const delta = Number((predictedGpa - currentGpa).toFixed(2));

  // Calculate target grade requirements
  const targetRequiredGrades = useMemo(() => {
    const target = parseFloat(targetGpaInput);
    if (isNaN(target) || target <= 0 || target > 4.0) return null;

    const requiredTotalPoints = target * totalCredits;
    return {
      target,
      requiredTotalPoints: requiredTotalPoints.toFixed(1),
      isFeasible: requiredTotalPoints <= totalCredits * 4.0,
    };
  }, [targetGpaInput, totalCredits]);

  const gradeOptions = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            GPA Prediction Engine
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Simulate future assessment outcomes and test scenario-based target goals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTargetSolver(!showTargetSolver)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-blue-700" />
            <span>{showTargetSolver ? 'Hide Target Solver' : 'Target GPA Solver'}</span>
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-700" />
            Reset Predictions
          </button>
        </div>
      </div>

      {/* Target Solver Drawer */}
      {showTargetSolver && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-800" />
                Target GPA Formulation
              </h3>
              <p className="text-xs text-blue-900/80 mt-0.5">
                Specify your desired semester GPA to evaluate mathematical credit requirements.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="target-gpa" className="text-xs font-semibold text-blue-950">
                Target GPA (Max 4.0):
              </label>
              <input
                id="target-gpa"
                type="number"
                step="0.05"
                min="2.0"
                max="4.0"
                value={targetGpaInput}
                onChange={(e) => setTargetGpaInput(e.target.value)}
                className="w-24 px-2.5 py-1 text-sm font-mono font-bold bg-white border border-blue-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
            </div>
          </div>

          {targetRequiredGrades && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-950 flex flex-wrap items-center gap-4">
              <span>
                Required Weighted Grade Points: <strong className="font-mono">{targetRequiredGrades.requiredTotalPoints}</strong> out of {totalCredits * 4} maximum.
              </span>
              <span>
                Status: {targetRequiredGrades.isFeasible ? (
                  <span className="font-semibold text-emerald-800">Mathematically Feasible</span>
                ) : (
                  <span className="font-semibold text-red-800">Exceeds 4.0 Maximum Ceiling</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Predict Your Semester GPA Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Predict Your Semester GPA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Change the predicted grade for any course below to instantly simulate the impact on your GPA.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
          >
            Reset Predictions
          </button>
        </div>

        {/* GPA Comparison Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-8 text-center">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Current GPA
            </div>
            <div className="text-4xl font-extrabold text-blue-700 font-mono tabular-nums mt-2">
              {currentGpa.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Based on evaluated internal scores</div>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg">
            <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Predicted GPA
            </div>
            <div className="text-4xl font-extrabold text-blue-900 font-mono tabular-nums mt-2">
              {predictedGpa.toFixed(2)}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1">
              {delta > 0 ? (
                <span className="text-emerald-700 font-semibold font-mono">+{delta.toFixed(2)} Projection Boost</span>
              ) : delta < 0 ? (
                <span className="text-red-700 font-semibold font-mono">{delta.toFixed(2)} Projection Drop</span>
              ) : (
                <span className="text-slate-600">Parity with Current Standing</span>
              )}
            </div>
          </div>
        </div>

        {/* Course Grade Selection Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Course Code</th>
                <th className="py-3 px-4">Course Name</th>
                <th className="py-3 px-4 text-center">Credits</th>
                <th className="py-3 px-4 text-center">Current Grade</th>
                <th className="py-3 px-4 text-center">Predicted Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(courses || []).map((course) => {
                const currentSelected = predictedGrades[course.code] ?? course.currentGrade;
                const isModified = currentSelected !== course.currentGrade;

                return (
                  <tr
                    key={course.code}
                    className={`transition-colors ${isModified ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {course.code}
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div>{course.name}</div>
                      <div className="text-xs text-slate-500 font-normal">
                        Instructor: {course.facultyName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700 tabular-nums">
                      {course.credits}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 text-slate-800 rounded">
                        {course.currentGrade} ({GRADE_POINTS[course.currentGrade]?.toFixed(1)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select
                        aria-label={`Predicted grade for ${course.code}`}
                        value={currentSelected}
                        onChange={(e) => handleGradeChange(course.code, e.target.value)}
                        className="px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 shadow-sm"
                      >
                        {gradeOptions.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade} ({GRADE_POINTS[grade]?.toFixed(1)} pts)
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* GPA Insights & Recommendations Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">GPA Insights</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Based on your current performance and predicted grades, here are some insights:
          </p>
        </div>

        {/* Insight Box */}
        <div className={`p-4 border rounded-md ${
          delta > 0
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : delta < 0
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-blue-50/80 border-blue-200 text-blue-950'
        }`}>
          <div className="text-sm font-bold flex items-center gap-2">
            {delta > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>Upward Academic Trajectory</span>
              </>
            ) : delta < 0 ? (
              <>
                <Target className="w-4 h-4 text-amber-700" />
                <span>Target Deficit Warning</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-blue-700" />
                <span>Stable Performance</span>
              </>
            )}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed">
            Your predicted GPA of <strong className="font-mono tabular-nums">{predictedGpa.toFixed(2)}</strong>{' '}
            {delta > 0
              ? 'represents a positive increment over your current standing. Consistent assignment submissions and exam revision will secure this outcome.'
              : delta < 0
              ? 'falls below your current benchmark. Revise high credit course subjects to protect your academic average.'
              : 'is maintaining your current academic standing. Consider setting higher goals for specific courses to improve your overall GPA.'}
          </p>
        </div>

        {/* Recommendations List */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Recommendations
          </h3>
          <ul className="space-y-2 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                Focus on improving your grade in <strong className="font-semibold text-slate-900">PHYS101</strong> and <strong className="font-semibold text-slate-900">MATH201</strong> to boost your GPA, as they hold the largest credit weights (4 credits each).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                Maintain your strong performance in <strong className="font-semibold text-slate-900">CS101</strong> (Intro to Computer Science) where your attendance is 92%.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                Consider the impact of each course&apos;s credit hours on your overall GPA: 4-credit courses account for 57% of your aggregate GPA calculation this semester.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
