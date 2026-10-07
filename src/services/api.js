// API service communicating with Express-Node backend and MongoDB
export const api = {
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
  async getAssignments() {
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching assignments:', e);
    }
    return null;
  },

  async createAssignment(assignment) {
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignment),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error creating assignment:', e);
    }
    return null;
  },

  async updateAssignment(id, updates) {
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error updating assignment:', e);
    }
    return null;
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

  // Custom Domain
  async getDomain() {
    try {
      const res = await fetch('/api/domain');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error fetching domain:', e);
    }
    return null;
  },

  async updateDomain(domain) {
    try {
      const res = await fetch('/api/domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API error updating domain:', e);
    }
    return null;
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