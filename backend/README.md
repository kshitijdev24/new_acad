# AcadLytic backend

## Setup

Use Node.js 20.19+ or 22.12+. From the project root, install both backend and
frontend dependencies. The frontend dependencies are required because the
backend loads `frontend/vite.config.ts` in development:

```sh
npm install --prefix backend
npm install --prefix frontend
```

Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY` to enable
Gemini chat and live voice. MongoDB is optional; when it is unavailable, the
backend uses its in-memory seed data.

Students can create accounts with the sign-up form using a unique email and
enrollment number and a password of at least 8 characters. Passwords are
hashed by the backend. Faculty and admin accounts are not self-registerable;
they must be provisioned by an administrator. The guest option is a student
demo and does not create an authenticated server session. Authenticated API
sessions use an HTTP-only cookie and are cleared by Logout. Sessions are held
in server memory and expire after 12 hours or when the backend restarts. If
MongoDB is unavailable, newly registered accounts are also held in memory and
will not survive a backend restart.

Start the backend and Vite development frontend from either the `backend` or
`frontend` directory:

```sh
# From backend:
npm run dev

# Or from frontend:
npm run dev
```

Alternatively, run `npm start` from this directory. Set `NODE_ENV=production`
to serve the prebuilt `frontend/dist` instead of Vite.
If the configured port is busy, the backend selects and prints the next
available URL; open that URL rather than the old server's address. The backend
serves both the API and frontend together, so do not start a separate Vite
server at the same time.

## PYQ upload, syllabus analysis, and practice papers

The authenticated `/api/v1` PYQ API uses the existing HTTP-only
`acadlytic_session` cookie. Unlike the app's in-memory fallback endpoints, PYQ
data requires a reachable MongoDB instance. Set `GEMINI_API_KEY` to enable
question parsing, topic mapping, and generated practice questions. The worker
uses a recoverable in-process queue; queued and interrupted jobs are recovered
when the backend restarts. Uploads are stored under `backend/uploads` by
default and are excluded from Git.

Copy the added values from `.env.example` as needed:

- `LLM_MODEL`, `EMBEDDING_MODEL`: Gemini models for structured analysis and embeddings.
- `PYQ_UPLOAD_DIR`: upload directory, relative to `backend` or an absolute path.
- `PYQ_MAPPING_THRESHOLD`: minimum topic-mapping confidence (default `0.6`).
- `PYQ_DAILY_UPLOAD_QUOTA`, `PYQ_DAILY_LLM_QUOTA`, `PYQ_DAILY_EMBEDDING_QUOTA`: per-user UTC-day limits.
- `PYQ_MAX_UPLOAD_BYTES`: per-file limit (default 20 MiB).

Run `npm run indexes --prefix backend` to create the feature indexes. To add
three sample papers and a syllabus for an existing account, set
`PYQ_SEED_USER_ID` to that account's user ID and run
`npm run seed:pyq --prefix backend`. API documentation is served at
`http://localhost:3000/api/v1/docs` after signing in.

All API responses use `{ "success": true|false, "message": "...", "data": ... }`.
Replace `BASE`, `COOKIE`, and resource placeholders below with your server URL,
session cookie value, and IDs returned by previous requests.

```sh
BASE=http://localhost:3000
COOKIE='acadlytic_session=YOUR_SESSION_COOKIE'

# Create and list subjects
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"Algorithms","code":"CS204"}' "$BASE/api/v1/subjects"
curl -b "$COOKIE" "$BASE/api/v1/subjects"

# Save syllabus JSON and retrieve the saved units/topics
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"units":[{"name":"Algorithms","order":1,"topics":[{"name":"Graph traversal","keywords":["BFS","DFS"]}]}]}' \
  "$BASE/api/v1/subjects/SUBJECT_ID/syllabus"
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/syllabus"

# Upload papers (repeat each file with another -F files=@...)
curl -b "$COOKIE" -F subjectId=SUBJECT_ID -F examName='End Semester' \
  -F year=2024 -F totalMarks=100 -F duration=180 \
  -F files=@paper.pdf "$BASE/api/v1/pyqs/upload"
curl -b "$COOKIE" "$BASE/api/v1/pyqs/jobs/JOB_ID"
curl -b "$COOKIE" -X POST "$BASE/api/v1/pyqs/jobs/JOB_ID/retry"

# List/read/delete uploaded papers
curl -b "$COOKIE" "$BASE/api/v1/pyqs?subjectId=SUBJECT_ID&page=1&limit=20"
curl -b "$COOKIE" "$BASE/api/v1/pyqs/PAPER_ID"
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/pyqs/PAPER_ID"

# Analysis, ranked topics, syllabus coverage, and questions needing a manual map
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/analysis"
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/important-topics?level=high&limit=20"
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/syllabus-coverage"
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/unmapped-questions"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"topicIds":["TOPIC_ID"],"unitId":"UNIT_ID"}' "$BASE/api/v1/questions/QUESTION_ID"

# Generate/list/read/export an estimated practice paper
curl -b "$COOKIE" -X POST -H 'Content-Type: application/json' \
  -d '{"totalMarks":100,"duration":180,"difficulty":"medium"}' \
  "$BASE/api/v1/subjects/SUBJECT_ID/probable-paper"
curl -b "$COOKIE" "$BASE/api/v1/subjects/SUBJECT_ID/probable-papers"
curl -b "$COOKIE" "$BASE/api/v1/probable-papers/PROBABLE_PAPER_ID"
curl -b "$COOKIE" -o practice-paper.pdf \
  "$BASE/api/v1/probable-papers/PROBABLE_PAPER_ID/export?format=pdf"

# Delete this account's PYQ subjects, papers, questions, and generated papers
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/me/pyq-data"
```

Probable-paper probabilities are estimates from uploaded trends, not
guarantees. Scanned PDFs and image uploads use OCR; processing errors are
available from the job status endpoint and failed jobs can be retried.

## GPA prediction engine

The authenticated GPA endpoints use the existing HTTP-only
`acadlytic_session` cookie and MongoDB. They read the signed-in student's
semester enrollments, course evaluation schemes, graded component scores,
assignment submissions, and finalized course results. Student requests are
restricted to their own records; faculty access is limited to students in
courses they teach, while admins and advisors use the academic-record access
policy. Predictions and saved scenarios never write official course grades.

Create the demo grading scales, a current semester with six courses, partial
assessment marks, and 70 historical credits after creating the demo student:

```sh
npm run seed:gpa --prefix backend
```

The seed creates a configurable 4.0 scale for the demo program and a separate
10.0 scale for testing. It uses `GPA_DEMO_USER_ID` to select the demo account.
Set the 4.0 scale's `programId` to the student's program ID when using a
different demo program.

The course percentage is the weighted mean of graded components, normalized
by their evaluated weight:

```text
currentPercent = Σ((obtainedMarks / maxMarks) × weightPercent)
                 / Σ(evaluated weightPercent) × 100
remainingWeightPercent = max(0, 100 - evaluatedWeightPercent)
requiredOnRemaining = (desiredGradeMinPercent - earnedWeightedPoints)
                      / (remainingWeightPercent / 100)
SGPA = Σ(gradePoints × credits) / Σ(credits)
predictedCGPA = (completedPoints + predictedSemesterPoints)
                / (completedCredits + predictedSemesterCredits)
```

GPA values are rounded using the grading scale's configured half-up precision.
The target solver searches the configured grades while honoring final grades,
locked grades, grade floors implied by marks already earned, and the scale's
upper grade. Its recommendations and all scores are predictions, not official
results. The API returns `{ "success": true|false, "message": "...", "data": ... }`.

Replace `BASE` and `COOKIE` with the backend URL and current session cookie.
`SEMESTER_ID`, `SCENARIO_ID`, and course codes are values returned by earlier
requests.

```sh
BASE=http://localhost:3000
COOKIE='acadlytic_session=YOUR_SESSION_COOKIE'

# Load grading scale and this student's current semester
curl -b "$COOKIE" "$BASE/api/v1/gpa/engine?semesterId=current"

# Simulate predicted grades and cumulative impact
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"semesterId":"current","predictedGrades":{"CS101":"A"},"includeCumulative":true}' \
  "$BASE/api/v1/gpa/predict"

# Find grade plans for a target; lock a course at its selected grade
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"semesterId":"current","targetGpa":3.7,"lockedGrades":{"CS101":"A"}}' \
  "$BASE/api/v1/gpa/target-solver"

# Find the score needed on remaining work for a desired course grade
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"semesterId":"current","desiredGrade":"A"}' \
  "$BASE/api/v1/gpa/course/CS101/required-score"

# Load server-generated recommendations
curl -b "$COOKIE" "$BASE/api/v1/gpa/insights?semesterId=current"

# Save, list, rename/update, and delete a user's scenario
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"Reach 3.7","semesterId":"current","predictedGrades":{"CS101":"A"},"targetGpa":3.7}' \
  "$BASE/api/v1/gpa/scenarios"
curl -b "$COOKIE" "$BASE/api/v1/gpa/scenarios"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"name":"Updated target","targetGpa":3.75}' \
  "$BASE/api/v1/gpa/scenarios/SCENARIO_ID"
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/gpa/scenarios/SCENARIO_ID"
```

OpenAPI documentation is available at `/api/v1/gpa/docs` after signing in.

## Academic performance trends

The authenticated performance API uses the existing `acadlytic_session` cookie
and requires MongoDB. Trend results are calculated from the student's semester
enrollments, assignment submissions, cohort aggregates, and academic settings.
Student endpoints are restricted to the signed-in student's own records.
Faculty access is limited to their assigned courses; admin and advisor trend
access is by student ID. Individual cohort scores are never returned.

The trend endpoint returns `{ "success": true, "data": ... }`:

```json
{
  "success": true,
  "data": {
    "semesters": [
      {
        "name": "Sem 1",
        "semesterNumber": 1,
        "year": "2024-25",
        "sgpa": 3.35,
        "cgpa": 3.35,
        "credits": 20,
        "isCurrent": false
      }
    ],
    "assignments": [
      {
        "id": "ASSIGNMENT_ID",
        "title": "Lab Report",
        "courseId": "COURSE_ID",
        "date": "Oct 12",
        "isoDate": "2026-10-12T23:59:59.000Z",
        "scorePercent": 91,
        "classAveragePercent": 82.4,
        "weight": 10,
        "status": "Graded",
        "submittedOnTime": true,
        "type": "lab"
      }
    ],
    "kpis": {
      "currentCgpa": 3.55,
      "firstSgpa": 3.35,
      "cgpaGrowth": 0.2,
      "avgAssignmentScore": 89.2,
      "unweightedAvgAssignmentScore": 89.2,
      "avgCohortScore": 80.8,
      "unweightedAvgCohortScore": 80.8,
      "outperformanceDelta": 8.4,
      "assignmentPercentile": 92,
      "topPercentLabel": "Top 10%",
      "distinction": {
        "threshold": 3.5,
        "label": "Dean's Honor Roll",
        "achieved": true
      },
      "gradedCount": 8,
      "totalAssignments": 10,
      "onTimePercent": 100,
      "benchmarkPercent": 80,
      "gpaScale": 4
    },
    "meta": {
      "semesterRangeLabel": "Sem 1 to Sem 5",
      "lastUpdated": "2026-10-12T12:00:00.000Z"
    }
  }
}
```

`classAveragePercent`, cohort KPI fields, and percentile are `null` when the
cohort does not meet the configured privacy threshold. `fromSemester`,
`toSemester`, and `courseId` filter the trend; `includeCohort=false` suppresses
all cohort analytics. Configure the in-memory cache with
`PERFORMANCE_CACHE_TTL_MS` (default 300000) and the privacy threshold with
`PERFORMANCE_PRIVACY_THRESHOLD` (default 5). Set `REDIS_URL` only for future
shared-cache deployments; the current cache is in-process.
Academic settings also configure the repeat policy (`latest` or `all`) and
whether incomplete or withdrawn attempts are excluded (the default) or
included in GPA calculations.

Seed the five fixture semesters, assignments, their cohort averages, and 30
synthetic comparison students with:

```sh
npm run seed:performance --prefix backend
```

To migrate legacy `SemesterRecord` and assignment rows for the demo student:

```sh
npm run migrate:performance --prefix backend
```

All examples below use `BASE` and `COOKIE` from the PYQ section above.
`STUDENT_ID` can be a Student document ID or its user ID. `COURSE_ID`,
`SEMESTER_ID`, `ASSIGNMENT_ID`, and `SUBMISSION_ID` are IDs returned by the
corresponding endpoints. The API docs UI is available at
`$BASE/api/v1/performance-trend/docs`.

```sh
# GET /students/me/performance-trend
curl -b "$COOKIE" "$BASE/api/v1/students/me/performance-trend?fromSemester=1&toSemester=5&includeCohort=true"

# GET /students/:id/performance-trend (admin, faculty, or advisor)
curl -b "$COOKIE" "$BASE/api/v1/students/STUDENT_ID/performance-trend?courseId=COURSE_ID"

# GET /students/me/semesters
curl -b "$COOKIE" "$BASE/api/v1/students/me/semesters?page=1&limit=20"

# POST /semesters (admin/faculty)
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"studentId":"STUDENT_ID","semesterNumber":6,"academicYear":"2027-28","status":"current","enrollments":[{"courseId":"COURSE_ID","credits":3,"grade":"A","gradePoint":4,"gradeStatus":"graded"}]}' \
  "$BASE/api/v1/semesters"

# PATCH /semesters/:id (admin/faculty)
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"completed","enrollments":[{"courseId":"COURSE_ID","credits":3,"grade":"A","gradePoint":4}]}' \
  "$BASE/api/v1/semesters/SEMESTER_ID"

# POST /semesters/:id/recompute (admin/faculty)
curl -b "$COOKIE" -X POST "$BASE/api/v1/semesters/SEMESTER_ID/recompute"

# GET /students/me/assignments
curl -b "$COOKIE" "$BASE/api/v1/students/me/assignments?semesterId=SEMESTER_ID&status=graded&page=1&limit=20"

# POST /assignments (admin/faculty)
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"courseId":"COURSE_ID","semesterId":"SEMESTER_ID","title":"Lab report","type":"lab","dueDate":"2027-01-15T23:59:00Z","maxScore":100,"weightPercent":10}' \
  "$BASE/api/v1/assignments"

# PATCH /assignments/:id (admin/faculty)
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"weightPercent":12,"dueDate":"2027-01-20T23:59:00Z"}' \
  "$BASE/api/v1/assignments/ASSIGNMENT_ID"

# POST /assignments/:id/submissions (signed-in student; real file required)
curl -b "$COOKIE" -X POST -F file=@solution.pdf -F note='Implementation notes' \
  "$BASE/api/v1/assignments/ASSIGNMENT_ID/submissions"

# PATCH /submissions/:id/grade (faculty/admin)
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"score":91}' "$BASE/api/v1/submissions/SUBMISSION_ID/grade"

# GET /settings/academic (admin)
curl -b "$COOKIE" "$BASE/api/v1/settings/academic"

# PUT /settings/academic (admin)
curl -b "$COOKIE" -X PUT -H 'Content-Type: application/json' \
  -d '{"programId":"default","distinctionThreshold":3.6,"distinctionLabel":"Dean'\''s List","benchmarkPercent":82,"privacyThreshold":8}' \
  "$BASE/api/v1/settings/academic"

# GET /students/me/performance-trend/export?format=csv
curl -b "$COOKIE" -o performance-trend.csv \
  "$BASE/api/v1/students/me/performance-trend/export?format=csv"
```

## Admin dashboard, custom domains, and course directory

The admin API is available under `/api/v1/admin`, requires the authenticated
`acadlytic_session` cookie and the `admin` role, and scopes institution and
department queries from the authenticated account. Existing BVCOE users and
legacy courses are associated with the seeded institution during MongoDB
startup; rerun the migration explicitly with:

```sh
npm run seed:admin-dashboard --prefix backend
npm run indexes --prefix backend
```

The demo hostname is seeded as `pending_verification`, not active: marking it
active without a live CNAME and unique TXT proof would violate tenant takeover
protection. The dashboard exposes its generated TXT token so an operator can
verify it against real DNS.

Configure `PLATFORM_CNAME_TARGET` and the platform host allowlist before
deployment. Only active domains with successful CNAME and TXT verification are
used for tenant routing. Unknown or unverified hosts receive HTTP 421; tenant
lookups are cached in-process for 60 seconds. Include the platform’s normal
deployment host in `PLATFORM_ALLOWED_HOSTS`. The session cookie remains
HTTP-only, host-only, and `SameSite=Strict`.

For local development, `SSL_PROVIDER=stub` simulates an active certificate.
For production, set `SSL_PROVIDER=cloudflare`,
`CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ZONE_ID`; private provider credentials
are read from environment variables and are never written to audit records.
`ACME_EMAIL` is reserved for an ACME provider adapter. Active domains are
re-verified every six hours, and certificate status is refreshed within 30
days of expiry. Configure `SMTP_URL` and optionally `ADMIN_NOTIFICATION_EMAIL`
to email admins after repeated DNS verification failures. `REDIS_URL` remains
reserved; this implementation uses an in-process host cache and interval
worker.

Domain setup flow:

1. `POST /domain` with the hostname. The response includes the required CNAME
   and unique TXT records. The domain remains `pending_verification`.
2. Create both records with the DNS provider, then call `POST /domain/verify`.
   Only a matching CNAME target and TXT token activate tenant routing.
3. Call `POST /domain/ssl/provision` after verification. The configured
   provider returns `active`, `provisioning`, or `failed`.
4. `DELETE /domain` disables and releases the hostname while retaining its
   audit record.

Every admin endpoint example below uses `BASE` and `COOKIE` from the earlier
sections. IDs are the MongoDB IDs returned by the API.

```sh
# Dashboard and institution profile
curl -b "$COOKIE" "$BASE/api/v1/admin/dashboard"
curl -b "$COOKIE" "$BASE/api/v1/admin/institution"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"city":"New Delhi","nirfBand":"201-300","accreditations":["AICTE Approved","NBA Accredited"],"department":{"name":"Computer Science & Engineering","code":"CSE"},"affiliation":{"university":"Guru Gobind Singh Indraprastha University","short":"GGSIPU"}}' \
  "$BASE/api/v1/admin/institution"

# Domain management
curl -b "$COOKIE" "$BASE/api/v1/admin/domain"
curl -b "$COOKIE" -X POST -H 'Content-Type: application/json' \
  -d '{"domain":"portal.college.edu.in"}' "$BASE/api/v1/admin/domain"
curl -b "$COOKIE" -X POST "$BASE/api/v1/admin/domain/verify"
curl -b "$COOKIE" -X POST "$BASE/api/v1/admin/domain/ssl/provision"
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/admin/domain"

# Courses, faculty, enrollment, and CSV export
curl -b "$COOKIE" "$BASE/api/v1/admin/courses?search=CS&status=active&semester=5&page=1&limit=20"
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"code":"CS401","name":"Distributed Systems","credits":4,"capacity":70,"status":"upcoming","session":"2027-28","semester":7}' \
  "$BASE/api/v1/admin/courses"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"name":"Advanced Distributed Systems","capacity":72}' \
  "$BASE/api/v1/admin/courses/COURSE_ID"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"active"}' "$BASE/api/v1/admin/courses/COURSE_ID/status"
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/admin/courses/COURSE_ID?force=true"
curl -b "$COOKIE" "$BASE/api/v1/admin/faculty"
curl -b "$COOKIE" -X PUT -H 'Content-Type: application/json' \
  -d '{"facultyIds":["FACULTY_USER_ID"],"primaryFacultyId":"FACULTY_USER_ID"}' \
  "$BASE/api/v1/admin/courses/COURSE_ID/faculty"
curl -b "$COOKIE" "$BASE/api/v1/admin/courses/COURSE_ID/enrollments?page=1&limit=20"
curl -b "$COOKIE" -o department-courses.csv \
  "$BASE/api/v1/admin/courses/export?format=csv"
```

The dashboard returns `{ "success": true, "data": { "institution": ..., "domain": ..., "courses": [...], "stats": ... } }`.
Course enrollment totals are grouped from `Enrollment` records with status
`enrolled`; peer/student enrollment records are not included in the dashboard
response. Faculty allotments are restricted to faculty users in the admin’s
institution and department, and past allotments remain in `CourseFaculty`
history.

## Assignment tracker

The assignment tracker API is mounted at `/api/v1` and uses the existing
HTTP-only `acadlytic_session` cookie. It requires MongoDB and scopes student
requests to the signed-in student's profile and enrollments, faculty requests
to assigned courses, and admin requests to the institution on the session.
Assignment status, list totals, and completion rates are computed by the
backend. The legacy `/api/assignments` endpoints return `410 Gone`; use these
versioned endpoints instead.

Uploads are stored outside the public frontend tree under
`ASSIGNMENT_UPLOAD_DIR` (default `backend/assignment-uploads`) and are served
only through the authorized download endpoint. The API validates extension,
MIME type, file signatures, and configured size limits. Set `CLAMAV_HOST` to
enable ClamAV INSTREAM scanning; upload requests fail if a configured scanner
is unavailable. `ASSIGNMENT_TIMEZONE` and `ASSIGNMENT_DUE_TIME` control the
interpretation of date-only deadlines. The in-process worker checks reminders
every 15 minutes; unique database keys prevent duplicate notifications. It
does not require Redis.

Run the demo fixture seed and legacy assignment migration with:

```sh
npm run seed:assignments --prefix backend
npm run migrate:assignments --prefix backend
npm run indexes --prefix backend
```

The seed creates four tenant-scoped courses, twelve assignments, and two
sample submissions for the demo student. It also prepares the demo faculty
account and course allotments. Configure `ASSIGNMENT_DEMO_USER_ID` and
`ASSIGNMENT_DEMO_FACULTY_ID` to seed against different provisioned users.
Assignment API documentation is served at
`$BASE/api/v1/assignments/docs` after signing in.

List responses contain `{ "success": true, "data": { "items": [...], "pagination": {...}, "stats": {...} } }`.
Assignment items include the computed `status`, authorization booleans
(`canEdit`, `canSubmit`), and the signed-in user's submission metadata only.
Faculty submission endpoints return student rows only for courses that
faculty member teaches.

```sh
# List assignments, stats, and available courses
curl -b "$COOKIE" "$BASE/api/v1/assignments?status=All&page=1&limit=100"
curl -b "$COOKIE" "$BASE/api/v1/assignments/stats"
curl -b "$COOKIE" "$BASE/api/v1/assignments/courses"
curl -b "$COOKIE" "$BASE/api/v1/assignments/ASSIGNMENT_ID"

# Create a personal assignment (student) or course assignment (faculty)
curl -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"courseId":"COURSE_ID","title":"Lab report","description":"Submit the lab analysis","dueDate":"2027-01-15","weightPercent":10,"maxMarks":100}' \
  "$BASE/api/v1/assignments"

# Edit, soft-delete, or toggle personal completion
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"title":"Updated lab report","dueDate":"2027-01-20","weightPercent":12}' \
  "$BASE/api/v1/assignments/ASSIGNMENT_ID"
curl -b "$COOKIE" -X DELETE "$BASE/api/v1/assignments/ASSIGNMENT_ID"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"completed":true}' "$BASE/api/v1/assignments/ASSIGNMENT_ID/completion"

# Submit a real file and download it later (student owns the download)
curl -b "$COOKIE" -F file=@solution.pdf -F note='Implementation notes' \
  "$BASE/api/v1/assignments/ASSIGNMENT_ID/submissions"
curl -b "$COOKIE" -o solution.pdf \
  "$BASE/api/v1/submissions/SUBMISSION_ID/download"

# Faculty: inspect enrolled submissions and grade one
curl -b "$COOKIE" \
  "$BASE/api/v1/courses/COURSE_ID/assignments/ASSIGNMENT_ID/submissions?page=1&limit=50"
curl -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' \
  -d '{"obtainedMarks":91,"feedback":"Good analysis"}' \
  "$BASE/api/v1/submissions/SUBMISSION_ID/grade"

# Read and acknowledge notifications
curl -b "$COOKIE" "$BASE/api/v1/notifications?page=1&limit=50&unreadOnly=true"
curl -b "$COOKIE" -X PATCH "$BASE/api/v1/notifications/NOTIFICATION_ID/read"
curl -b "$COOKIE" -X POST "$BASE/api/v1/notifications/read-all"
```
