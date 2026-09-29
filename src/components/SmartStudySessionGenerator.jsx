import React, { useState, useEffect } from 'react';
import { generateSmartStudyPlan, fetchAiStudyPlanEnhancement } from '../utils/studyPlanner.js';
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  BrainCircuit,
  Lightbulb,
  ListTodo,
  ExternalLink,
  Flame,
} from 'lucide-react';

export const SmartStudySessionGenerator = ({
  assignments = [],
  courses = [],
  lectures = [],
  studentName = 'Student',
  onNavigateTab,
}) => {
  const [targetHours, setTargetHours] = useState(3.5);
  const [strategy, setStrategy] = useState('balanced');
  const [plan, setPlan] = useState(() =>
    generateSmartStudyPlan({
      assignments,
      lectures,
      courses,
      targetHours: 3.5,
      strategy: 'balanced',
    })
  );

  const [completedSessionIds, setCompletedSessionIds] = useState(new Set());
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiTip, setAiTip] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Active Focus Timer state
  const [activeTimerSession, setActiveTimerSession] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleRegenerate = (newHours = targetHours, newStrategy = strategy) => {
    const newPlan = generateSmartStudyPlan({
      assignments,
      lectures,
      courses,
      targetHours: newHours,
      strategy: newStrategy,
    });
    setPlan(newPlan);
    setAiTip(null);
  };

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSecondsLeft > 0) {
      interval = setInterval(() => {
        setTimerSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerSecondsLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsLeft]);

  const startSessionTimer = (session, minutes = 25) => {
    setActiveTimerSession(session);
    setTimerSecondsLeft(minutes * 60);
    setIsTimerRunning(true);
  };

  const toggleSessionCompletion = (sessionId) => {
    setCompletedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const toggleTaskCompletion = (taskIdKey) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskIdKey)) {
        next.delete(taskIdKey);
      } else {
        next.add(taskIdKey);
      }
      return next;
    });
  };

  const handleFetchAiEnhancement = async () => {
    setIsGeneratingAi(true);
    try {
      const tips = await fetchAiStudyPlanEnhancement(plan, studentName, courses);
      setAiTip(tips);
    } catch (err) {
      console.error('Failed to get AI study enhancement:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyPlan = () => {
    const textLines = [
      `ACADLYTIC SMART DAILY STUDY PLAN - ${plan.date}`,
      `Target Study Time: ${plan.targetHours} Hours | Strategy: ${plan.strategy.toUpperCase()}`,
      `Overview: ${plan.summaryInsight}`,
      '',
      ...(plan.sessions || []).map((s, idx) => {
        return `[SESSION ${idx + 1}] ${s.timeBlock} • ${s.priority} • ${s.courseCode}: ${s.title}\n` +
          `  Technique: ${s.recommendedTechnique}\n` +
          `  Why: ${s.rationale}\n` +
          (s.actionItems || []).map((a) => `  [ ] ${a}`).join('\n') + '\n';
      }),
    ];
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const totalSessions = plan.sessions?.length || 0;
  const completedCount = (plan.sessions || []).filter((s) => completedSessionIds.has(s.id)).length;
  const progressPercent = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;
  const urgentCount = (assignments || []).filter((a) => a.status === 'Pending').length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Top Banner / Generator Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-800 rounded-md">
              <BrainCircuit className="w-5 h-5 text-blue-700" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Smart Study Session Generator
            </h2>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Algorithmic &amp; AI Driven
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Synthesizes {urgentCount} pending deliverables and {lectures.length} lecture syllabi into an actionable, prioritized daily workflow
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyPlan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Plan Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Plan</span>
              </>
            )}
          </button>
          <button
            onClick={handleFetchAiEnhancement}
            disabled={isGeneratingAi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
          >
            <Sparkles className={`w-3.5 h-3.5 text-purple-700 ${isGeneratingAi ? 'animate-spin' : ''}`} />
            <span>{isGeneratingAi ? 'Analyzing Plan...' : 'AI Cognitive Coaching'}</span>
          </button>
        </div>
      </div>

      {/* Plan Configuration Toolbar */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 my-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Target Hours */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Target Time:</span>
            <div className="inline-flex rounded-md shadow-xs">
              {[2.0, 3.5, 5.0].map((hours) => (
                <button
                  key={hours}
                  onClick={() => {
                    setTargetHours(hours);
                    handleRegenerate(hours, strategy);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium border first:rounded-l-md last:rounded-r-md transition-colors ${
                    targetHours === hours
                      ? 'bg-blue-700 text-white border-blue-700 z-10'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {hours}h {hours === 2.0 ? 'Sprint' : hours === 3.5 ? 'Balanced' : 'Deep Dive'}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Focus Mode:</span>
            <select
              value={strategy}
              onChange={(e) => {
                const newStrat = e.target.value;
                setStrategy(newStrat);
                handleRegenerate(targetHours, newStrat);
              }}
              className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md px-2.5 py-1 focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="balanced">Balanced (Deadlines + Lecture Previews)</option>
              <option value="deadlines">Urgent Deadlines First (&lt;24h)</option>
              <option value="mastery">Concept Mastery &amp; Code Implementation</option>
            </select>
          </div>
        </div>

        {/* Progress & Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-900">
              {completedCount} of {totalSessions} Blocks Done ({progressPercent}%)
            </div>
            <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => handleRegenerate()}
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md text-slate-600"
            title="Regenerate Plan"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rationale and Analytical Summary */}
      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md text-xs text-blue-900 mb-4 flex items-start gap-2.5">
        <Lightbulb className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-blue-950">Curriculum Strategy Insight: </span>
          <span>{plan.summaryInsight}</span>
        </div>
      </div>

      {/* Optional AI Coaching Tip */}
      {aiTip && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-950 mb-4 animate-fade-in">
          <div className="flex items-center gap-1.5 font-bold text-purple-900 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span>Gemini Academic Optimization Coaching:</span>
          </div>
          <div className="whitespace-pre-line text-purple-900 leading-relaxed font-sans">
            {aiTip}
          </div>
        </div>
      )}

      {/* Interactive Focus Timer Bar */}
      {activeTimerSession && (
        <div className="p-3.5 bg-slate-900 text-white rounded-lg shadow-lg mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-md">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Active Focus Session</div>
              <div className="text-sm font-bold text-white truncate max-w-sm">
                {activeTimerSession.title} ({activeTimerSession.courseCode})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
              {Math.floor(timerSecondsLeft / 60)}:
              {timerSecondsLeft % 60 < 10 ? `0${timerSecondsLeft % 60}` : timerSecondsLeft % 60}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs flex items-center gap-1"
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isTimerRunning ? 'Pause' : 'Resume'}</span>
              </button>
              <button
                onClick={() => {
                  setTimerSecondsLeft(25 * 60);
                  setIsTimerRunning(false);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                title="Reset timer to 25m"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTimerSession(null)}
                className="text-xs text-slate-400 hover:text-white px-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prioritized Study Sessions List */}
      <div className="space-y-3.5">
        {(plan.sessions || []).map((session, index) => {
          const isSessionDone = completedSessionIds.has(session.id);
          const priorityBg =
            session.priority === 'Critical'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : session.priority === 'High'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : session.priority === 'Medium'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200';

          return (
            <div
              key={session.id}
              className={`p-4 rounded-lg border transition-all ${
                isSessionDone
                  ? 'bg-slate-50/70 border-slate-200 opacity-70'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {/* Row Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => toggleSessionCompletion(session.id)}
                    className="cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors"
                    title={isSessionDone ? 'Mark Incomplete' : 'Mark Session Completed'}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${isSessionDone ? 'text-emerald-600 fill-emerald-100' : 'text-slate-300'}`}
                    />
                  </button>

                  <span className="font-mono text-xs font-bold text-slate-500">
                    Session {index + 1}
                  </span>

                  <span className="text-slate-300">|</span>

                  <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {session.timeBlock}
                  </span>

                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${priorityBg}`}>
                    {session.priority}
                  </span>

                  <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                    {session.courseCode}
                  </span>
                </div>

                {/* Right Quick Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => startSessionTimer(session, session.durationMinutes >= 60 ? 50 : 25)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                  >
                    <Play className="w-3 h-3 text-blue-700" />
                    <span>Focus Timer ({session.durationMinutes}m)</span>
                  </button>

                  {session.relatedAssignmentId && (
                    <button
                      onClick={() => onNavigateTab('assignments')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                      title="Navigate to Assignments"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Assignment</span>
                    </button>
                  )}

                  {session.relatedLectureTopic && (
                    <button
                      onClick={() => onNavigateTab('calendar')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                      title="View Lecture Schedule"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Lecture</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Pedagogical Rationale */}
              <div className="mt-2.5">
                <h3 className={`text-sm font-bold text-slate-900 ${isSessionDone ? 'line-through text-slate-500' : ''}`}>
                  {session.title}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  <span className="font-semibold text-slate-700">Rationale: </span>
                  {session.rationale}
                </p>
              </div>

              {/* Action Checklist & Pedagogical Technique */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2.5 border-t border-slate-100">
                <div className="md:col-span-2 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5 text-slate-400" />
                    <span>Session Deliverables Checklist:</span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {(session.actionItems || []).map((item, itemIdx) => {
                      const taskIdKey = `${session.id}-task-${itemIdx}`;
                      const isTaskDone = completedTaskIds.has(taskIdKey) || isSessionDone;
                      return (
                        <label
                          key={itemIdx}
                          className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isTaskDone}
                            onChange={() => toggleTaskCompletion(taskIdKey)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className={isTaskDone ? 'line-through text-slate-400' : ''}>
                            {item}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Recommended Technique:
                  </div>
                  <div className="font-medium text-slate-800 text-xs">
                    {session.recommendedTechnique}
                  </div>
                  {session.relatedLectureTopic && (
                    <div className="text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-200 truncate">
                      <span className="font-semibold">Lecture tie-in:</span> {session.relatedLectureTopic}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
