import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GRADE_POINTS } from '../data/mockData.js';

export function exportStudentDashboardPdf({
  currentUser,
  courses,
  assignments,
  currentGpa,
  overallAttendance,
  totalCredits,
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header banner background
  doc.setFillColor(30, 58, 138); // Deep Navy (#1e3a8a)
  doc.rect(0, 0, pageWidth, 70, 'F');

  // Institution title and app name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AcadLytic: Academic Performance Summary', margin, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);
  doc.text(
    "Bharati Vidyapeeth's College of Engineering (BVCOE), New Delhi - Department of CSE",
    margin,
    50
  );

  // Generation timestamp
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 50, { align: 'right' });

  // Student Details Block
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('STUDENT PROFILE', margin, 95);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, 100, pageWidth - margin, 100);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const leftColX = margin;
  const midColX = margin + 180;
  const rightColX = margin + 360;
  const studentMetaY = 115;

  doc.text(`Student Name: ${currentUser.name}`, leftColX, studentMetaY);
  doc.text(`Enrollment No: ${currentUser.enrollmentNumber || 'N/A'}`, leftColX, studentMetaY + 14);

  doc.text(`Department: ${currentUser.department}`, midColX, studentMetaY);
  doc.text(`Semester: ${currentUser.semester} (Odd Session 2026)`, midColX, studentMetaY + 14);

  doc.text(`Email: ${currentUser.email}`, rightColX, studentMetaY);
  doc.text(`Portal Status: Active Enrolled`, rightColX, studentMetaY + 14);

  // Key KPI Cards Row
  const kpiTop = 150;
  const kpiWidth = (pageWidth - margin * 2 - 30) / 4;
  const kpiHeight = 50;

  const kpis = [
    { label: 'CUMULATIVE GPA', value: currentGpa, sub: 'Scale of 4.00' },
    { label: 'COMPLETED CREDITS', value: `${totalCredits}`, sub: '4 Enrolled Courses' },
    { label: 'OVERALL ATTENDANCE', value: `${overallAttendance}%`, sub: 'Above 75% Rule' },
    {
      label: 'PENDING TASKS',
      value: `${(assignments || []).filter((a) => a.status === 'Pending').length}`,
      sub: `${(assignments || []).filter((a) => a.status === 'Completed').length} Graded`,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiWidth + 10);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(x, kpiTop, kpiWidth, kpiHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 8, kpiTop + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138);
    doc.text(kpi.value, x + 8, kpiTop + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 8, kpiTop + 43);
  });

  // Section: Course Progress Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('COURSE PROGRESS AND GRADES BREAKDOWN', margin, 222);

  const courseRows = (courses || []).map((c) => {
    const gradePts = (GRADE_POINTS[c.currentGrade] ?? 3.0).toFixed(1);
    const weightedPts = ((GRADE_POINTS[c.currentGrade] ?? 3.0) * c.credits).toFixed(1);
    return [
      c.code,
      c.name,
      `${c.credits}`,
      `${c.currentGrade} (${c.currentScore}%)`,
      `${gradePts}`,
      `${weightedPts}`,
      `${c.attendancePercent.toFixed(1)}% (${c.attendedClasses}/${c.totalClasses})`,
      c.facultyName,
    ];
  });

  autoTable(doc, {
    startY: 230,
    head: [
      [
        'Code',
        'Course Title',
        'Credits',
        'Internal Grade',
        'Grade Pts',
        'Weighted',
        'Attendance',
        'Faculty In-Charge',
      ],
    ],
    body: courseRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 },
      2: { halign: 'center', cellWidth: 42 },
      3: { halign: 'center', cellWidth: 65 },
      4: { halign: 'center', cellWidth: 45 },
      5: { halign: 'center', cellWidth: 45 },
      6: { halign: 'center', cellWidth: 70 },
      7: { cellWidth: 68 },
    },
    margin: { left: margin, right: margin },
  });

  // Calculate table end position
  const lastTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 400;

  // Section: Assignments & Deliverables
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('CURRENT SEMESTER DELIVERABLES', margin, lastTableY);

  const assignmentRows = (assignments || []).map((a) => [
    a.title,
    a.courseCode,
    `${a.weightPercent}%`,
    a.dueDate,
    a.status,
    a.obtainedMarks !== undefined ? `${a.obtainedMarks} / ${a.maxMarks}` : 'Pending Grading',
  ]);

  autoTable(doc, {
    startY: lastTableY + 8,
    head: [['Deliverable Title', 'Course', 'Weight', 'Due Date', 'Status', 'Marks']],
    body: assignmentRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 155 },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 45 },
      3: { halign: 'center', cellWidth: 65 },
      4: { halign: 'center', cellWidth: 65 },
      5: { halign: 'center', cellWidth: 130 },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 25 : 700;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Note: This document is an academic analytics summary generated from the AcadLytic portal. Final semester grade cards are issued by Guru Gobind Singh Indraprastha University (GGSIPU).',
    margin,
    finalY > 780 ? 780 : finalY,
    { maxWidth: pageWidth - margin * 2 }
  );

  const fileName = `AcadLytic_Student_Summary_${currentUser.name.replace(/\s+/g, '_')}_${dateStr.replace(/,/g, '').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
