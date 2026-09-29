import React, { useState } from 'react';
import { PyqTopicSuggestion, Course } from '../types/academic';
import {
  FileText,
  Upload,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ArrowRight,
  Download,
  Filter
} from 'lucide-react';

interface PyqSyllabusAnalyzerProps {
  courses: Course[];
  pyqTopics: PyqTopicSuggestion[];
}

export const PyqSyllabusAnalyzer: React.FC<PyqSyllabusAnalyzerProps> = ({
  courses,
  pyqTopics,
}) => {
  const [selectedCourse, setSelectedCourse] = useState<string>('CS101');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [isSimulatingScan, setIsSimulatingScan] = useState<boolean>(false);
  const [scanResultNotification, setScanResultNotification] = useState<string | null>(null);

  const unitsList = [
    { id: 'All', name: 'All Units Combined' },
    { id: 'U1', name: 'Unit 1: Computational Foundations' },
    { id: 'U2', name: 'Unit 2: Engineering Mathematics & Optics' },
    { id: 'U3', name: 'Unit 3: Data Structures & Algorithms' },
  ];

  const filteredTopics = pyqTopics.filter((t) => {
    if (selectedUnit !== 'All' && t.unitId !== selectedUnit) return false;
    return true;
  });

  const handleSimulateScan = () => {
    setIsSimulatingScan(true);
    setScanResultNotification(null);
    setTimeout(() => {
      setIsSimulatingScan(false);
      setScanResultNotification(
        'Paper parsed successfully: 12 questions extracted, mapped to Unit 3 Algorithms with 92% taxonomy confidence.'
      );
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            PYQ & Syllabus Analytics
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Historical Previous Year Question (PYQ) frequency modeling, unit weight distribution, and topic prioritization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              alert('Exporting Revision Priority Report (CSV format)...');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Priority CSV
          </button>
        </div>
      </div>

      {/* Upload Paper Banner (Chapter 6 Section 5 match) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-700" />
              <span>Question Paper Ingestion and Topic Mapping</span>
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Upload mid-term or past end-term question papers (PDF or scanned image). The structural parser extracts question blocks, calculates historical weight, and maps items to syllabus taxonomy nodes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleSimulateScan}
              disabled={isSimulatingScan}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 rounded transition-colors"
            >
              {isSimulatingScan ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Processing Layout OCR...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Scan Sample Paper</span>
                </>
              )}
            </button>
          </div>
        </div>

        {scanResultNotification && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{scanResultNotification}</span>
          </div>
        )}
      </div>

      {/* Filter and Course Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">Curriculum:</span>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded text-slate-900"
          >
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Filter Unit:</span>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
          >
            {unitsList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ranked High-Yield Topics Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
          <span>Ranked High-Yield Topics (Calculated from Historical Examination Papers)</span>
          <span className="text-xs text-slate-500 font-normal">
            Formula: α * RecencyFreq + β * NormalizedMarks + γ * CoOccurrence
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {filteredTopics.map((item, idx) => (
            <div
              key={item.topic}
              className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 bg-slate-100 text-slate-700 text-xs font-bold rounded flex items-center justify-center font-mono">
                    #{idx + 1}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{item.topic}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold font-mono">
                    Priority Score: {item.score.toFixed(1)} / 10
                  </span>
                  <span className="text-slate-500 font-mono">
                    Confidence: {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Syllabus Unit:</span>
                  <span className="font-semibold text-slate-800">{item.unitName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">PYQ Appearance:</span>
                  <span className="font-semibold text-slate-800 font-mono">{item.frequency} times</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Average Marks:</span>
                  <span className="font-semibold text-slate-800 font-mono">{item.avgMarks} marks</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Exam Yield:</span>
                  <span className="font-semibold text-emerald-700 font-mono">High Recurrence</span>
                </div>
              </div>

              {/* Representative Questions from Page 29 */}
              <div className="mt-2 pt-3 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Sample Representative Questions:
                </div>
                <div className="space-y-1.5">
                  {item.representativeQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-2.5 bg-slate-50 rounded text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <span className="leading-relaxed">"{q.text}"</span>
                      <div className="flex items-center gap-2 shrink-0 text-slate-500 font-mono text-[11px]">
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-800">
                          {q.id}
                        </span>
                        <span>{q.marks} Marks</span>
                        <span>({q.year})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
