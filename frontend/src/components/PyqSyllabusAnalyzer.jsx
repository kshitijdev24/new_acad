import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { api } from '../services/api.js';

const terminalStatuses = new Set(['done', 'failed']);
const inputClass = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const buttonClass = 'inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50';

function LevelBadge({ level }) {
  const styles = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${styles[level] || styles.low}`}>
      {level || 'low'}
    </span>
  );
}

export const PyqSyllabusAnalyzer = ({
  courses = [],
  isAuthenticated,
  onAuthenticationRequired,
}) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [subject, setSubject] = useState(null);
  const [syllabus, setSyllabus] = useState([]);
  const [syllabusJson, setSyllabusJson] = useState('');
  const [selectedSyllabusFile, setSelectedSyllabusFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [examName, setExamName] = useState('End Semester Examination');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [totalMarks, setTotalMarks] = useState('100');
  const [duration, setDuration] = useState('180');
  const [difficulty, setDifficulty] = useState('medium');
  const [jobs, setJobs] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [coverage, setCoverage] = useState({ neverAsked: [], covered: [] });
  const [unmapped, setUnmapped] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState({});
  const [probablePaper, setProbablePaper] = useState(null);
  const [activeTab, setActiveTab] = useState('important');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const authenticationRequiredRef = useRef(onAuthenticationRequired);

  const currentCourse = useMemo(
    () => courses.find((course) => course.code === selectedCourse) || courses[0],
    [courses, selectedCourse]
  );
  const isPolling = jobs.some((job) => !terminalStatuses.has(job.status));
  const allTopics = useMemo(
    () => syllabus.flatMap((unit) => (unit.topics || []).map((topic) => ({
      ...topic,
      unitName: unit.name,
    }))),
    [syllabus]
  );

  useEffect(() => {
    authenticationRequiredRef.current = onAuthenticationRequired;
  }, [onAuthenticationRequired]);

  useEffect(() => {
    if (!selectedCourse && courses.length) setSelectedCourse(courses[0].code);
  }, [courses, selectedCourse]);

  useEffect(() => {
    let active = true;
    setSubject(null);
    setAnalysis(null);
    setProbablePaper(null);
    setJobs([]);
    if (!isAuthenticated || !currentCourse?.code) return () => { active = false; };

    async function loadOrCreateSubject() {
      setIsLoading(true);
      setError('');
      try {
        const subjects = await api.getPyqSubjects();
        let matching = subjects.find((item) => item.code === currentCourse.code);
        if (!matching) {
          matching = await api.createPyqSubject({
            name: currentCourse.name,
            code: currentCourse.code,
          });
        }
        if (active) setSubject(matching);
      } catch (requestError) {
        if (active) {
          if (requestError.status === 401) authenticationRequiredRef.current?.();
          setError(requestError.message || 'Unable to load the selected subject.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadOrCreateSubject();
    return () => { active = false; };
  }, [currentCourse?.code, currentCourse?.name, isAuthenticated]);

  async function refreshSubjectData(subjectId, isCurrent = () => true) {
    const [syllabusResult, analysisResult, coverageResult, unmappedResult, paperResult] =
      await Promise.all([
        api.getPyqSyllabus(subjectId),
        api.getPyqAnalysis(subjectId),
        api.getPyqCoverage(subjectId),
        api.getUnmappedPyqQuestions(subjectId),
        api.getPyqs(subjectId),
      ]);
    if (!isCurrent()) return;
    setSyllabus(syllabusResult);
    setSyllabusJson(JSON.stringify({
      units: syllabusResult.map((unit) => ({
        name: unit.name,
        order: unit.order,
        syllabusWeight: unit.syllabusWeight,
        topics: unit.topics.map((topic) => ({
          name: topic.name,
          keywords: topic.keywords,
          syllabusWeight: topic.syllabusWeight,
        })),
      })),
    }, null, 2));
    setAnalysis(analysisResult);
    setCoverage(coverageResult);
    setUnmapped(unmappedResult.questions || []);
    setJobs((previous) => {
      const activeJobs = (paperResult.papers || [])
        .filter((paper) => paper.jobId && !terminalStatuses.has(paper.status))
        .map((paper) => ({
          jobId: String(paper.jobId),
          paperId: String(paper._id),
          status: paper.status,
          progress: paper.progress || 0,
          failReason: paper.failReason || '',
        }));
      const previousById = new Map(previous.map((job) => [job.jobId, job]));
      return [...activeJobs, ...previous.filter((job) => !activeJobs.some((item) => item.jobId === job.jobId))]
        .map((job) => previousById.get(job.jobId) || job);
    });
  }

  useEffect(() => {
    let active = true;
    if (!subject?._id) return () => { active = false; };
    setIsLoading(true);
    refreshSubjectData(subject._id, () => active)
      .catch((requestError) => {
        if (active) {
          if (requestError.status === 401) authenticationRequiredRef.current?.();
          setError(requestError.message || 'Unable to load PYQ analysis.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [subject?._id]);

  useEffect(() => {
    if (!isPolling || !subject?._id) return undefined;
    let active = true;
    let finished = false;
    const timer = window.setInterval(async () => {
      try {
        const updated = await Promise.all(jobs.map(async (job) => {
          if (terminalStatuses.has(job.status)) return job;
          const result = await api.getPyqJob(job.jobId);
          return {
            ...job,
            status: result.status,
            progress: result.progress,
            failReason: result.failReason,
          };
        }));
        if (!active) return;
        setJobs(updated);
        if (!finished && updated.every((job) => terminalStatuses.has(job.status))) {
          finished = true;
          await refreshSubjectData(subject._id, () => active);
        }
      } catch (requestError) {
        if (active) {
          if (requestError.status === 401) authenticationRequiredRef.current?.();
          setError(requestError.message || 'Unable to refresh processing progress.');
        }
      }
    }, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isPolling, subject?._id]);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    setError('');
    if (selectedFiles.length + files.length > 10) {
      setError('Upload no more than 10 papers at once.');
      return;
    }
    const supported = /\.(pdf|jpe?g|png|docx)$/i;
    const invalid = files.find((file) => !supported.test(file.name) || file.size > 20 * 1024 * 1024);
    if (invalid) {
      setError('Each file must be a PDF, JPG, PNG, or DOCX no larger than 20 MB.');
      return;
    }
    setSelectedFiles((previous) => [...previous, ...files]);
  };

  const uploadPapers = async () => {
    if (!isAuthenticated) {
      onAuthenticationRequired();
      return;
    }
    if (!subject?._id || !selectedFiles.length) {
      setError('Choose a subject and at least one paper to upload.');
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const result = await api.uploadPyqs({
        subjectId: subject._id,
        files: selectedFiles,
        examName,
        year: Number(year),
        totalMarks: Number(totalMarks),
        duration: Number(duration),
      });
      setJobs((previous) => [...previous, ...result.map((job) => ({
        jobId: String(job.jobId),
        paperId: String(job.paperId),
        status: job.status,
        progress: 0,
        failReason: '',
      }))]);
      setSelectedFiles([]);
    } catch (requestError) {
      if (requestError.status === 401) onAuthenticationRequired();
      setError(requestError.message || 'Unable to upload the selected papers.');
    } finally {
      setIsUploading(false);
    }
  };

  const saveSyllabus = async () => {
    if (!subject?._id) return;
    setIsSavingSyllabus(true);
    setError('');
    try {
      const result = selectedSyllabusFile
        ? await api.savePyqSyllabus(subject._id, selectedSyllabusFile)
        : await api.savePyqSyllabus(subject._id, JSON.parse(syllabusJson));
      setSyllabus(result);
      setSyllabusJson(JSON.stringify({
        units: result.map((unit) => ({
          name: unit.name,
          order: unit.order,
          syllabusWeight: unit.syllabusWeight,
          topics: unit.topics.map(({ name, keywords, syllabusWeight }) => ({
            name,
            keywords,
            syllabusWeight,
          })),
        })),
      }, null, 2));
      setSelectedSyllabusFile(null);
      await refreshSubjectData(subject._id);
    } catch (requestError) {
      if (requestError.status === 401) authenticationRequiredRef.current?.();
      setError(requestError.message || 'Unable to save the syllabus.');
    } finally {
      setIsSavingSyllabus(false);
    }
  };

  const generatePaper = async () => {
    if (!subject?._id) return;
    setIsGenerating(true);
    setError('');
    try {
      setProbablePaper(await api.generateProbablePaper(subject._id, {
        totalMarks: Number(totalMarks),
        duration: Number(duration),
        difficulty,
      }));
      setActiveTab('probable');
    } catch (requestError) {
      if (requestError.status === 401) onAuthenticationRequired();
      setError(requestError.message || 'Unable to generate a probable practice paper.');
    } finally {
      setIsGenerating(false);
    }
  };

  const fixQuestion = async (question) => {
    const topicId = selectedTopics[question._id];
    if (!topicId) {
      setError('Choose a syllabus topic before saving this mapping.');
      return;
    }
    const topic = allTopics.find((item) => String(item._id) === topicId);
    try {
      await api.updatePyqQuestion(question._id, {
        topicIds: [topicId],
        unitId: String(topic.unitId),
      });
      setSelectedTopics((previous) => {
        const next = { ...previous };
        delete next[question._id];
        return next;
      });
      await refreshSubjectData(subject._id);
    } catch (requestError) {
      if (requestError.status === 401) authenticationRequiredRef.current?.();
      setError(requestError.message || 'Unable to save the question mapping.');
    }
  };

  const downloadPaper = async () => {
    try {
      const blob = await api.exportProbablePaper(probablePaper._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `practice-paper-v${probablePaper.version}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      if (requestError.status === 401) authenticationRequiredRef.current?.();
      setError(requestError.message || 'Unable to export the practice paper.');
    }
  };

  const downloadAnalysis = () => {
    if (!analysis) return;
    const blob = new Blob(
      [JSON.stringify({ subject: subject?.name, analysis, coverage }, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${subject?.code || 'subject'}-pyq-analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    ['important', 'Important Units & Topics'],
    ['trends', 'Trends'],
    ['coverage', 'Syllabus Coverage'],
    ['unmapped', `Unmapped (${unmapped.length})`],
    ['probable', 'Probable Paper'],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PYQ &amp; Syllabus Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Upload past papers to find high-yield syllabus topics and create a trend-based practice paper.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Subject
          <select
            className={inputClass}
            value={currentCourse?.code || ''}
            onChange={(event) => setSelectedCourse(event.target.value)}
            disabled={!courses.length}
          >
            {courses.map((course) => (
              <option key={course.code} value={course.code}>{course.code} - {course.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className={buttonClass} onClick={downloadAnalysis} disabled={!analysis}>
          <Download className="h-4 w-4" /> Download analysis
        </button>
      </header>

      {!isAuthenticated && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Sign in to upload papers, save syllabus data, and view your analysis.
          <button type="button" className="ml-2 font-bold underline" onClick={onAuthenticationRequired}>Sign in</button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 className="font-bold text-slate-900">Syllabus</h2>
            <p className="mt-1 text-xs text-slate-600">Upload a PDF/DOCX syllabus or paste its structured units and topics as JSON.</p>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Syllabus file
            <input
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png"
              className="mt-1 block w-full text-sm"
              onChange={(event) => setSelectedSyllabusFile(event.target.files?.[0] || null)}
            />
          </label>
          {selectedSyllabusFile && <p className="text-xs text-slate-600">{selectedSyllabusFile.name}</p>}
          <textarea
            value={syllabusJson}
            onChange={(event) => setSyllabusJson(event.target.value)}
            rows={7}
            spellCheck="false"
            className={`${inputClass} w-full font-mono text-xs`}
            placeholder={'{"units":[{"name":"Unit 1","order":1,"topics":[{"name":"Topic A","keywords":["keyword"]}]}]}'}
            aria-label="Syllabus JSON"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {syllabus.length} units · {allTopics.length} topics loaded
            </span>
            <button type="button" className={buttonClass} onClick={saveSyllabus} disabled={isSavingSyllabus || !subject}>
              {isSavingSyllabus ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save syllabus
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 className="font-bold text-slate-900">Upload past papers</h2>
            <p className="mt-1 text-xs text-slate-600">Up to 10 papers per upload, 20 MB each. Scanned PDFs and images are processed with OCR.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Exam name
              <input className={`${inputClass} mt-1 w-full`} value={examName} onChange={(event) => setExamName(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Year
              <input className={`${inputClass} mt-1 w-full`} type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Total marks
              <input className={`${inputClass} mt-1 w-full`} type="number" min="1" value={totalMarks} onChange={(event) => setTotalMarks(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Duration (minutes)
              <input className={`${inputClass} mt-1 w-full`} type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </label>
          </div>
          <label
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600 hover:border-blue-400"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFiles(event.dataTransfer.files);
            }}
          >
            <Upload className="mb-2 h-5 w-5 text-blue-700" />
            Drop paper files here or browse
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="sr-only"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          {selectedFiles.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-700">
              {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-700" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-red-700 hover:underline"
                    onClick={() => setSelectedFiles((items) => items.filter((_, fileIndex) => fileIndex !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={buttonClass} onClick={uploadPapers} disabled={isUploading || !selectedFiles.length || !subject}>
            {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Queue paper analysis
          </button>
          {jobs.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              {jobs.map((job) => (
                <div key={job.jobId} className="rounded bg-slate-50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize">{job.status}</span>
                    <span>{job.progress || 0}%</span>
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold text-blue-700"
                        onClick={async () => {
                          try {
                            await api.retryPyqJob(job.jobId);
                            setJobs((items) => items.map((item) => item.jobId === job.jobId
                              ? { ...item, status: 'queued', progress: 0, failReason: '' }
                              : item));
                          } catch (requestError) {
                            if (requestError.status === 401) authenticationRequiredRef.current?.();
                            setError(requestError.message || 'Unable to retry this paper.');
                          }
                        }}
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
                    <div className="h-full bg-blue-700 transition-all" style={{ width: `${job.progress || 0}%` }} />
                  </div>
                  {job.failReason && <p className="mt-1 text-red-700">{job.failReason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <nav className="flex flex-wrap gap-1 border-b border-slate-200 p-2" aria-label="PYQ analysis tabs">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded px-3 py-2 text-xs font-semibold ${activeTab === id ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-4 p-5">
          {isLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading subject analysis...</p>}
          {activeTab === 'important' && (
            <>
              <h2 className="font-bold text-slate-900">Most important units and topics</h2>
              {!analysis?.topics?.length && <p className="text-sm text-slate-500">Upload past papers and map a syllabus to build rankings.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {(analysis?.units || []).map((item) => (
                  <article key={item.unitId} className="rounded border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{item.unit?.name || 'Syllabus unit'}</h3>
                      <LevelBadge level={item.level} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.importanceScore}/100 · {item.marksPercent}% of mapped marks</p>
                    <p className="mt-2 text-xs text-slate-500">{item.reason}</p>
                  </article>
                ))}
              </div>
              <div className="divide-y divide-slate-100">
                {(analysis?.topics || []).map((item) => (
                  <div key={item.topicId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold text-slate-800">{item.topic?.name || 'Topic'}</p>
                      <p className="text-xs text-slate-500">{item.unit?.name} · {item.reason}</p>
                      {item.tags?.length > 0 && <p className="mt-1 text-xs font-semibold text-blue-700">{item.tags.join(' · ')}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{item.importanceScore}/100</span>
                      <span>{item.totalMarks} marks</span>
                      <LevelBadge level={item.level} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeTab === 'trends' && (
            <>
              <h2 className="font-bold text-slate-900">Year-wise paper trends</h2>
              {(analysis?.yearly || []).length === 0 && <p className="text-sm text-slate-500">No analyzed papers yet.</p>}
              <div className="space-y-2">
                {(analysis?.yearly || []).map((yearRow) => (
                  <div key={yearRow._id} className="grid grid-cols-3 gap-3 rounded bg-slate-50 p-3 text-sm">
                    <span className="font-semibold">{yearRow._id}</span>
                    <span>{yearRow.questions} questions</span>
                    <span>{yearRow.marks} marks represented</span>
                  </div>
                ))}
              </div>
              <h3 className="pt-2 font-semibold text-slate-800">Question types</h3>
              {(analysis?.questionTypes || []).map((type) => (
                <p key={type._id} className="text-sm text-slate-600">{type._id}: {type.count} questions · {type.marks} marks</p>
              ))}
              <h3 className="pt-2 font-semibold text-slate-800">Repeated questions</h3>
              {(analysis?.repeatedQuestions || []).map((group) => (
                <div key={group.groupId} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Repeated {group.count} times</p>
                  {group.questions.map((question) => <p key={question._id}>{question.year}: {question.text}</p>)}
                </div>
              ))}
            </>
          )}
          {activeTab === 'coverage' && (
            <>
              <h2 className="font-bold text-slate-900">Syllabus coverage</h2>
              <p className="text-xs text-slate-600">Topics with no mapped past questions need coverage; high recurrence is based on uploaded papers.</p>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold text-red-800">Never asked ({coverage.neverAsked?.length || 0})</h3>
                  {(coverage.neverAsked || []).map((item) => <p key={item.topic._id} className="py-1 text-sm">{item.topic.name} <span className="text-xs text-slate-500">· {item.topic.unitId?.name}</span></p>)}
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-emerald-800">Covered ({coverage.covered?.length || 0})</h3>
                  {(coverage.covered || []).map((item) => <p key={item.topic._id} className="py-1 text-sm">{item.topic.name} <span className="text-xs text-slate-500">· {item.stats.frequency} papers</span></p>)}
                </div>
              </div>
            </>
          )}
          {activeTab === 'unmapped' && (
            <>
              <h2 className="font-bold text-slate-900">Questions to map manually</h2>
              {!unmapped.length && <p className="text-sm text-slate-500">No unmapped questions. New uploads will appear here if a confident syllabus match is unavailable.</p>}
              <div className="space-y-3">
                {unmapped.map((question) => (
                  <article key={question._id} className="space-y-2 rounded border border-slate-200 p-3">
                    <p className="text-sm text-slate-800">{question.year} · Q{question.number}{question.subPart}: {question.text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={inputClass}
                        value={selectedTopics[question._id] || ''}
                        onChange={(event) => setSelectedTopics((previous) => ({ ...previous, [question._id]: event.target.value }))}
                      >
                        <option value="">Select a topic</option>
                        {allTopics.map((topic) => <option key={topic._id} value={topic._id}>{topic.unitName} — {topic.name}</option>)}
                      </select>
                      <button type="button" className={buttonClass} onClick={() => fixQuestion(question)}>Save mapping</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {activeTab === 'probable' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Most probable practice paper</h2>
                  <p className="mt-1 text-xs text-slate-600">An estimate based on uploaded paper patterns, topic importance, and syllabus coverage—not a guarantee.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select className={inputClass} value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Paper difficulty">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <button type="button" className={buttonClass} onClick={generatePaper} disabled={isGenerating || !subject}>
                    {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Generate paper
                  </button>
                </div>
              </div>
              {!probablePaper && <p className="text-sm text-slate-500">Generate a paper using the latest uploaded exam pattern.</p>}
              {probablePaper && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-blue-50 p-3">
                    <p className="text-sm font-semibold text-blue-900">Version {probablePaper.version} · {probablePaper.totalMarks} marks · {probablePaper.duration} minutes</p>
                    <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800" onClick={downloadPaper}>
                      <Download className="h-4 w-4" /> Export PDF
                    </button>
                  </div>
                  {probablePaper.sections.map((section) => (
                    <section key={section.title}>
                      <h3 className="border-b border-slate-200 pb-1 font-bold">{section.title}</h3>
                      <ol className="list-decimal space-y-3 pl-5 pt-3">
                        {section.questions.map((question, index) => (
                          <li key={`${section.title}-${index}`} className="pl-1 text-sm">
                            <p>{question.text} <span className="font-semibold">[{question.marks}]</span></p>
                            <p className="mt-1 text-xs text-slate-500">
                              {question.probability}% estimated · {question.reason}
                            </p>
                            {question.hint && <p className="mt-1 text-xs text-blue-800">Hint: {question.hint}</p>}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {isPolling && <p className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Paper processing runs in the background.</p>}
    </div>
  );
};
