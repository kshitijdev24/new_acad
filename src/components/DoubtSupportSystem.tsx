import React, { useState } from 'react';
import { DoubtQuestion, Course, UserProfile } from '../types/academic';
import {
  HelpCircle,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  Bot,
  Mic
} from 'lucide-react';

interface DoubtSupportSystemProps {
  currentUser: UserProfile;
  courses: Course[];
  questions: DoubtQuestion[];
  onAddQuestion: (question: Omit<DoubtQuestion, 'id' | 'replies'>) => void;
  onAddReply: (questionId: string, replyText: string) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenVoiceModal?: () => void;
}

export const DoubtSupportSystem: React.FC<DoubtSupportSystemProps> = ({
  currentUser,
  courses,
  questions,
  onAddQuestion,
  onAddReply,
  onNavigateTab,
  onOpenVoiceModal,
}) => {
  // New question form state
  const [questionTitle, setQuestionTitle] = useState('');
  const [relatedCourse, setRelatedCourse] = useState(courses[0]?.code ?? 'CS101');
  const [questionDetails, setQuestionDetails] = useState('');

  // Browse filter
  const [browseFilter, setBrowseFilter] = useState<string>('All');
  const [courseFilter, setCourseFilter] = useState<string>('All');

  // Expanded questions state
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(questions[0]?.id ?? null);
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionTitle.trim() || !questionDetails.trim()) return;

    onAddQuestion({
      title: questionTitle.trim(),
      courseCode: relatedCourse,
      details: questionDetails.trim(),
      postedBy: currentUser.name,
      authorRole: currentUser.role,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
    });

    setQuestionTitle('');
    setQuestionDetails('');
  };

  const handleReplySubmit = (questionId: string) => {
    const text = replyInput[questionId]?.trim();
    if (!text) return;

    onAddReply(questionId, text);
    setReplyInput((prev) => ({ ...prev, [questionId]: '' }));
  };

  const filteredQuestions = questions.filter((q) => {
    if (browseFilter === 'Answered' && q.status !== 'Answered') return false;
    if (browseFilter === 'Pending' && q.status !== 'Pending') return false;
    if (courseFilter !== 'All' && q.courseCode !== courseFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Doubt Support System
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Direct academic mentoring and peer technical discourse between students and faculty.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('ai-chat')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-blue-700" />
              <span>Consult Gemini AI</span>
            </button>
          )}

          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors shadow-sm"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Voice</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Ask a Question + Browse Questions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ask a Question Form (Fig 1.5 match) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              <span>Ask a Question</span>
            </h2>

            <form onSubmit={handleQuestionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Question Title:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter a clear, specific title for your question"
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Related Course:
                </label>
                <select
                  value={relatedCourse}
                  onChange={(e) => setRelatedCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-700"
                >
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Question Details:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your question in detail, include what you have tried so far and where you are stuck."
                  value={questionDetails}
                  onChange={(e) => setQuestionDetails(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
                >
                  Submit Question
                </button>
              </div>
            </form>
          </div>

          {/* Browse Questions Section (Fig 1.5 match) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <h2 className="text-base font-bold text-slate-900">Browse Questions</h2>

              <div className="flex items-center gap-3 text-xs">
                <select
                  aria-label="Filter questions by status"
                  value={browseFilter}
                  onChange={(e) => setBrowseFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium"
                >
                  <option value="All">All Questions</option>
                  <option value="Answered">Answered</option>
                  <option value="Pending">Pending</option>
                </select>

                <select
                  aria-label="Filter questions by course"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium font-mono"
                >
                  <option value="All">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions List */}
            <div className="divide-y divide-slate-100">
              {filteredQuestions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No questions currently match the chosen parameters.
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isExpanded = expandedQuestionId === q.id;

                  return (
                    <div key={q.id} className="py-4">
                      <div
                        onClick={() =>
                          setExpandedQuestionId(isExpanded ? null : q.id)
                        }
                        className="cursor-pointer hover:bg-slate-50/70 p-2 rounded transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 hover:text-blue-900 transition-colors">
                            {q.title}
                          </h3>
                          <div className="text-xs text-slate-400 font-mono text-left sm:text-right shrink-0">
                            <div>Posted by: {q.postedBy}</div>
                            <div>Date: {q.date}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-800 rounded">
                            {q.courseCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                              q.status === 'Answered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {q.status}
                          </span>
                          <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {q.replies.length} replies
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Thread */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pl-4 space-y-3">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-900 block mb-1">
                              Question Details:
                            </span>
                            {q.details}
                          </div>

                          {/* Replies */}
                          <div className="space-y-2">
                            {q.replies.map((rep) => (
                              <div
                                key={rep.id}
                                className={`p-3 rounded text-xs leading-relaxed border ${
                                  rep.isFacultyResponse
                                    ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between font-semibold mb-1">
                                  <div className="flex items-center gap-1.5">
                                    {rep.isFacultyResponse ? (
                                      <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
                                    ) : (
                                      <User className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                    <span>{rep.authorName}</span>
                                    {rep.isFacultyResponse && (
                                      <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-bold uppercase">
                                        Faculty In-Charge
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400 font-normal">
                                    {rep.createdAt}
                                  </span>
                                </div>
                                <p className="mt-1">{rep.text}</p>
                              </div>
                            ))}
                          </div>

                          {/* Reply Input Box */}
                          <div className="flex gap-2 pt-2">
                            <input
                              type="text"
                              placeholder={
                                currentUser.role === 'faculty'
                                  ? 'Post verified faculty answer...'
                                  : 'Contribute a follow-up or clarifying explanation...'
                              }
                              value={replyInput[q.id] ?? ''}
                              onChange={(e) =>
                                setReplyInput({ ...replyInput, [q.id]: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleReplySubmit(q.id);
                              }}
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
                            />
                            <button
                              onClick={() => handleReplySubmit(q.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded flex items-center gap-1 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Reply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Tips for Effective Questions (Fig 1.5 match) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Tips for Effective Questions
            </h2>
            <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-blue-700 font-bold">•</span>
                <span>Be specific about what you are trying to accomplish.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-700 font-bold">•</span>
                <span>Include relevant code snippets or equations when applicable.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-700 font-bold">•</span>
                <span>Describe what you have already tried and where execution halts.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-700 font-bold">•</span>
                <span>Check if your question has already been asked in the department archive.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-700 font-bold">•</span>
                <span>Use proper formatting to make your question readable for faculty review.</span>
              </li>
            </ul>
          </div>

          {/* Department Faculty Hours Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-xs">
            <h3 className="font-bold text-slate-900 mb-2">Faculty Mentorship Hours</h3>
            <p className="text-slate-600 mb-3">
              Faculty members review and resolve question threads within 24 working hours.
            </p>
            <div className="space-y-2 text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>Ms. Deepika Yadav (CS101)</span>
                <span className="font-mono text-slate-500">Tue / Thu 3-4 PM</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>Dr. R. K. Sharma (MATH201)</span>
                <span className="font-mono text-slate-500">Mon / Wed 2-3 PM</span>
              </div>
              <div className="flex justify-between">
                <span>Dr. Neha Gupta (PHYS101)</span>
                <span className="font-mono text-slate-500">Fri 11 AM-12 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
