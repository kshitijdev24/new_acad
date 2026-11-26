// API service communicating with Express-Node backend and MongoDB
async function submitAuthRequest(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Authentication request failed.');
  }
  return result.user;
}

async function requestPyq(path, { method = 'GET', body } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(path, {
    method,
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'The PYQ request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result.data;
}

async function requestAdmin(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'The admin request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result.data;
}

async function requestGpa(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'The GPA request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result.data;
}

async function requestAssignment(path, { method = 'GET', body } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'The assignment request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function uploadAssignmentRequest(path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', path);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let result = {};
      try {
        result = JSON.parse(request.responseText || '{}');
      } catch {
        result = {};
      }
      if (request.status < 200 || request.status >= 300 || result.success === false) {
        const error = new Error(result.message || 'The assignment upload could not be completed.');
        error.status = request.status;
        reject(error);
        return;
      }
      resolve(result.data);
    };
    request.onerror = () => reject(new Error('The assignment upload could not be completed.'));
    request.onabort = () => reject(new Error('The assignment upload was cancelled.'));
    request.send(body);
  });
}

export const api = {
  async getCurrentUser() {
    const response = await fetch('/api/auth/session');
    if (!response.ok) {
      throw new Error('Unable to restore the current session.');
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(
        'The current server is serving the frontend without the backend API. Open the URL printed by the backend on startup.'
      );
    }
    const result = await response.json();
    return result.user;
  },

  async registerCandidate(candidate) {
    return submitAuthRequest('/api/auth/register', candidate);
  },

  async login(credentials) {
    return submitAuthRequest('/api/auth/login', credentials);
  },

  async logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Unable to log out. Please try again.');
    }
  },

  async analyzePyqPapers(payload) {
    const response = await fetch('/api/pyq/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || 'Unable to analyze the uploaded papers.');
      error.status = response.status;
      throw error;
    }
    return result;
  },

  getPyqSubjects() {
    return requestPyq('/api/v1/subjects');
  },

  createPyqSubject(subject) {
    return requestPyq('/api/v1/subjects', { method: 'POST', body: subject });
  },

  getPyqSyllabus(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/syllabus`);
  },

  savePyqSyllabus(subjectId, syllabusOrFile) {
    if (syllabusOrFile instanceof File) {
      const body = new FormData();
      body.append('file', syllabusOrFile);
      return requestPyq(`/api/v1/subjects/${subjectId}/syllabus`, { method: 'POST', body });
    }
    return requestPyq(`/api/v1/subjects/${subjectId}/syllabus`, {
      method: 'POST',
      body: syllabusOrFile,
    });
  },

  uploadPyqs({ subjectId, files, examName, year, totalMarks, duration }) {
    const body = new FormData();
    body.append('subjectId', subjectId);
    body.append('examName', examName);
    body.append('year', String(year));
    body.append('totalMarks', String(totalMarks));
    body.append('duration', String(duration));
    for (const file of files) body.append('files', file);
    return requestPyq('/api/v1/pyqs/upload', { method: 'POST', body });
  },

  getPyqJob(jobId) {
    return requestPyq(`/api/v1/pyqs/jobs/${jobId}`);
  },

  retryPyqJob(jobId) {
    return requestPyq(`/api/v1/pyqs/jobs/${jobId}/retry`, { method: 'POST' });
  },

  getPyqs(subjectId) {
    const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
    return requestPyq(`/api/v1/pyqs${query}`);
  },

  getPyqAnalysis(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/analysis`);
  },

  getImportantPyqTopics(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/important-topics`);
  },

  getPyqCoverage(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/syllabus-coverage`);
  },

  getUnmappedPyqQuestions(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/unmapped-questions`);
  },

  updatePyqQuestion(questionId, changes) {
    return requestPyq(`/api/v1/questions/${questionId}`, { method: 'PATCH', body: changes });
  },

  generateProbablePaper(subjectId, options) {
    return requestPyq(`/api/v1/subjects/${subjectId}/probable-paper`, {
      method: 'POST',
      body: options,
    });
  },

  getProbablePapers(subjectId) {
    return requestPyq(`/api/v1/subjects/${subjectId}/probable-papers`);
  },

  getProbablePaper(paperId) {
    return requestPyq(`/api/v1/probable-papers/${paperId}`);
  },

  async exportProbablePaper(paperId) {
    const response = await fetch(`/api/v1/probable-papers/${paperId}/export?format=pdf`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const error = new Error(result.message || 'Unable to export the practice paper.');
      error.status = response.status;
      throw error;
    }
    return response.blob();
  },

  // Health
  async getHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  // Courses
  async getCourses() {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching courses:', e);
    }
    return null;
  },

  async updateCourse(code, updates) {
    try {
      const res = await fetch(`/api/courses/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error updating course:', e);
    }
    return null;
  },

  // Assignments
  async getAssignments({ status = 'All', courseCode, sortBy = 'dueDate', order = 'asc', page = 1, limit = 100 } = {}) {
    const query = new URLSearchParams({
      status,
      sortBy,
      order,
      page: String(page),
      limit: String(limit),
    });
    if (courseCode) query.set('courseCode', courseCode);
    const data = await requestAssignment(`/api/v1/assignments?${query}`);
    return data.items;
  },

  getAssignmentStats() {
    return requestAssignment('/api/v1/assignments/stats');
  },

  getAssignmentCourses() {
    return requestAssignment('/api/v1/assignments/courses');
  },

  getAssignment(id) {
    return requestAssignment(`/api/v1/assignments/${encodeURIComponent(id)}`);
  },

  async createAssignment(assignment) {
    return requestAssignment('/api/v1/assignments', { method: 'POST', body: assignment });
  },

  async updateAssignment(id, updates) {
    const fields = ['title', 'description', 'dueDate', 'weightPercent', 'maxMarks', 'allowLateSubmission', 'latePenaltyPercent', 'allowedFileTypes', 'maxFileSizeMB'];
    const body = Object.fromEntries(fields.filter((field) => updates[field] !== undefined).map((field) => [field, updates[field]]));
    return requestAssignment(`/api/v1/assignments/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  },

  deleteAssignment(id) {
    return requestAssignment(`/api/v1/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  setAssignmentCompletion(id, completed) {
    return requestAssignment(`/api/v1/assignments/${encodeURIComponent(id)}/completion`, {
      method: 'PATCH',
      body: { completed },
    });
  },

  submitAssignment(id, file, note = '', onProgress) {
    const body = new FormData();
    body.append('file', file);
    body.append('note', note);
    return uploadAssignmentRequest(
      `/api/v1/assignments/${encodeURIComponent(id)}/submissions`,
      body,
      onProgress
    );
  },

  getAssignmentSubmissions(courseId, assignmentId, { page = 1, limit = 100 } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    return requestAssignment(
      `/api/v1/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions?${query}`
    );
  },

  gradeAssignment(submissionId, { obtainedMarks, feedback = '' }) {
    return requestAssignment(`/api/v1/submissions/${encodeURIComponent(submissionId)}/grade`, {
      method: 'PATCH',
      body: { obtainedMarks, feedback },
    });
  },

  getAssignmentNotifications({ page = 1, limit = 50, unreadOnly = false } = {}) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      unreadOnly: String(unreadOnly),
    });
    return requestAssignment(`/api/v1/notifications?${query}`);
  },

  markAssignmentNotificationRead(id) {
    return requestAssignment(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  },

  deleteAssignmentNotification(id) {
    return requestAssignment(`/api/v1/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  markAllAssignmentNotificationsRead() {
    return requestAssignment('/api/v1/notifications/read-all', { method: 'POST', body: {} });
  },

  // Lectures
  async getLectures() {
    try {
      const res = await fetch('/api/lectures');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching lectures:', e);
    }
    return null;
  },

  async createLecture(event) {
    try {
      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error creating lecture:', e);
    }
    return null;
  },

  // Announcements
  async getAnnouncements() {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching announcements:', e);
    }
    return null;
  },

  // Doubts
  async getDoubts() {
    try {
      const res = await fetch('/api/doubts');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching doubts:', e);
    }
    return null;
  },

  async createDoubt(doubt) {
    try {
      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doubt),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error creating doubt:', e);
    }
    return null;
  },

  async addDoubtReply(doubtId, reply) {
    try {
      const res = await fetch(`/api/doubts/${doubtId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reply),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error adding reply:', e);
    }
    return null;
  },

  // Performance
  async getPerformance() {
    try {
      const res = await fetch('/api/performance');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching performance:', e);
    }
    return null;
  },

  async getPerformanceTrend({ fromSemester, toSemester, courseId, includeCohort = true } = {}) {
    const query = new URLSearchParams();
    if (fromSemester != null) query.set('fromSemester', String(fromSemester));
    if (toSemester != null) query.set('toSemester', String(toSemester));
    if (courseId) query.set('courseId', String(courseId));
    query.set('includeCohort', String(includeCohort));
    const response = await fetch(`/api/v1/students/me/performance-trend?${query}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      const error = new Error(result.message || 'Unable to load academic performance.');
      error.status = response.status;
      throw error;
    }
    return result.data;
  },

  getGpaEngine(semesterId = 'current') {
    const query = new URLSearchParams({ semesterId });
    return requestGpa(`/api/v1/gpa/engine?${query}`);
  },

  predictGpa(prediction) {
    return requestGpa('/api/v1/gpa/predict', { method: 'POST', body: prediction });
  },

  solveGpaTarget(target) {
    return requestGpa('/api/v1/gpa/target-solver', { method: 'POST', body: target });
  },

  getGpaRequiredScore(code, request) {
    return requestGpa(
      `/api/v1/gpa/course/${encodeURIComponent(code)}/required-score`,
      { method: 'POST', body: request }
    );
  },

  getGpaInsights(semesterId = 'current') {
    const query = new URLSearchParams({ semesterId });
    return requestGpa(`/api/v1/gpa/insights?${query}`);
  },

  getGpaScenarios(semesterId) {
    const query = new URLSearchParams();
    if (semesterId) query.set('semesterId', semesterId);
    return requestGpa(`/api/v1/gpa/scenarios${query.size ? `?${query}` : ''}`);
  },

  saveGpaScenario(scenario) {
    return requestGpa('/api/v1/gpa/scenarios', { method: 'POST', body: scenario });
  },

  updateGpaScenario(id, updates) {
    return requestGpa(`/api/v1/gpa/scenarios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: updates,
    });
  },

  deleteGpaScenario(id) {
    return requestGpa(`/api/v1/gpa/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  getAdminDashboard() {
    return requestAdmin('/api/v1/admin/dashboard');
  },

  getAdminInstitution() {
    return requestAdmin('/api/v1/admin/institution');
  },

  updateAdminInstitution(updates) {
    return requestAdmin('/api/v1/admin/institution', { method: 'PATCH', body: updates });
  },

  getAdminDomain() {
    return requestAdmin('/api/v1/admin/domain');
  },

  createAdminDomain(domain) {
    return requestAdmin('/api/v1/admin/domain', { method: 'POST', body: { domain } });
  },

  verifyAdminDomain() {
    return requestAdmin('/api/v1/admin/domain/verify', { method: 'POST', body: {} });
  },

  provisionAdminSsl() {
    return requestAdmin('/api/v1/admin/domain/ssl/provision', { method: 'POST', body: {} });
  },

  deleteAdminDomain() {
    return requestAdmin('/api/v1/admin/domain', { method: 'DELETE' });
  },

  getAdminCourses({ search, status, semester, page = 1, limit = 20 } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (semester != null) query.set('semester', String(semester));
    return requestAdmin(`/api/v1/admin/courses?${query}`);
  },

  createAdminCourse(course) {
    return requestAdmin('/api/v1/admin/courses', { method: 'POST', body: course });
  },

  updateAdminCourse(courseId, updates) {
    return requestAdmin(`/api/v1/admin/courses/${encodeURIComponent(courseId)}`, {
      method: 'PATCH',
      body: updates,
    });
  },

  updateAdminCourseStatus(courseId, status) {
    return requestAdmin(`/api/v1/admin/courses/${encodeURIComponent(courseId)}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  allotAdminCourseFaculty(courseId, assignment) {
    return requestAdmin(`/api/v1/admin/courses/${encodeURIComponent(courseId)}/faculty`, {
      method: 'PUT',
      body: assignment,
    });
  },

  getAdminFaculty() {
    return requestAdmin('/api/v1/admin/faculty');
  },

  getAdminCourseEnrollments(courseId, { page = 1, limit = 20 } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    return requestAdmin(`/api/v1/admin/courses/${encodeURIComponent(courseId)}/enrollments?${query}`);
  },

  deleteAdminCourse(courseId, { force = false } = {}) {
    return requestAdmin(`/api/v1/admin/courses/${encodeURIComponent(courseId)}?force=${force}`, {
      method: 'DELETE',
    });
  },

  async exportAdminCourses() {
    const response = await fetch('/api/v1/admin/courses/export?format=csv');
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || 'Unable to export department courses.');
    }
    return response.blob();
  },

};

async function sendChat(message) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  return data.reply;
}