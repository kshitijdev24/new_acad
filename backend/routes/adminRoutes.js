import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import {
  Course,
  CourseFaculty,
  Department,
  Enrollment,
  Institution,
  University,
  User,
} from '../models.js';
import { asyncHandler, requireFeatureAuth, sendSuccess } from '../utils/http.js';
import {
  AdminApiError,
  getAdminDashboard,
  listAdminCourses,
  recordAdminAudit,
  resolveAdminScope,
  sanitizeAuditValue,
} from '../services/adminDashboardService.js';
import {
  createTenantDomain,
  disableTenantDomain,
  getTenantDomain,
  provisionTenantSsl,
  verifyTenantDomain,
} from '../services/customDomainService.js';
import {
  courseDeleteQuerySchema,
  courseExportQuerySchema,
  courseFacultySchema,
  courseInputSchema,
  courseListQuerySchema,
  coursePatchSchema,
  courseStatusSchema,
  domainInputSchema,
  enrollmentsQuerySchema,
  institutionPatchSchema,
} from '../validation/adminSchemas.js';

const router = express.Router();
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin requests. Try again shortly.', data: null },
});
const domainVerifyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Domain verification is limited to 10 attempts per hour.', data: null },
});

function parse(schema, value) {
  return schema.parse(value);
}

function normalizedName(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function safeSnapshot(value) {
  return sanitizeAuditValue(typeof value?.toObject === 'function' ? value.toObject() : value);
}

function requireScopedCourse(req, scope) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AdminApiError(400, 'A valid course ID is required.');
  }
  return Course.findOne({
    _id: req.params.id,
    institutionId: scope.institution._id,
    departmentId: scope.department._id,
  });
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

router.use(requireFeatureAuth, adminRateLimit);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AdminApiError(403, 'Admin access required.'));
  }
  return next();
});
router.use(asyncHandler(async (req, res, next) => {
  req.adminScope = await resolveAdminScope(req.user);
  if (
    req.tenantInstitutionId
    && String(req.tenantInstitutionId) !== String(req.adminScope.institution._id)
  ) {
    throw new AdminApiError(403, 'This admin account cannot access another institution’s domain.');
  }
  return next();
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  sendSuccess(res, 'Admin dashboard loaded.', await getAdminDashboard(req.adminScope));
}));

router.get('/institution', asyncHandler(async (req, res) => {
  const dashboard = await getAdminDashboard(req.adminScope);
  sendSuccess(res, 'Institution profile loaded.', dashboard.institution);
}));

router.patch('/institution', asyncHandler(async (req, res) => {
  const input = parse(institutionPatchSchema, req.body);
  const { institution, department } = req.adminScope;
  const before = {
    institution: safeSnapshot(institution),
    department: safeSnapshot(department),
    university: institution.universityId
      ? safeSnapshot(await University.findById(institution.universityId))
      : null,
  };

  for (const field of ['name', 'shortName', 'city', 'state', 'accreditations', 'nirfBand']) {
    if (input[field] !== undefined) institution[field] = input[field];
  }
  if (input.affiliation) {
    const currentUniversity = institution.universityId
      ? await University.findById(institution.universityId)
      : null;
    const universityName = input.affiliation.university ?? currentUniversity?.name;
    const universityShortName = input.affiliation.short ?? currentUniversity?.shortName;
    if (!universityName || !universityShortName) {
      throw new AdminApiError(400, 'Provide both university name and short name for a new affiliation.');
    }
    const university = await University.findOneAndUpdate(
      { name: universityName, shortName: universityShortName },
      { $setOnInsert: { name: universityName, shortName: universityShortName } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    institution.universityId = university._id;
  }
  if (input.department) {
    if (input.department.name !== undefined) department.name = input.department.name;
    if (input.department.code !== undefined) department.code = input.department.code.toUpperCase();
    await department.save();
  }
  await institution.save();
  const after = {
    institution: safeSnapshot(institution),
    department: safeSnapshot(department),
    university: institution.universityId
      ? safeSnapshot(await University.findById(institution.universityId))
      : null,
  };
  await recordAdminAudit(req, req.adminScope, {
    action: 'institution.updated',
    entityType: 'Institution',
    entityId: institution._id,
    before,
    after,
  });
  sendSuccess(res, 'Institution profile updated.', (await getAdminDashboard(req.adminScope)).institution);
}));

router.get('/domain', asyncHandler(async (req, res) => {
  sendSuccess(res, 'Custom domain loaded.', await getTenantDomain(req.adminScope));
}));

router.post('/domain', asyncHandler(async (req, res) => {
  const input = parse(domainInputSchema, req.body);
  const domain = await createTenantDomain(req.adminScope, req.user, input.domain, req);
  sendSuccess(res, 'Add these DNS records, then verify the domain.', {
    domain,
    dnsRecords: [
      { type: 'CNAME', host: domain.domain, value: domain.target },
      {
        type: 'TXT',
        host: domain.verification.host,
        value: domain.verification.value,
      },
    ],
  }, 201);
}));

router.post('/domain/verify', domainVerifyRateLimit, asyncHandler(async (req, res) => {
  const domain = await verifyTenantDomain(req.adminScope, req);
  sendSuccess(res, domain.status === 'active' ? 'DNS records verified.' : 'DNS verification did not pass.', domain);
}));

router.post('/domain/ssl/provision', asyncHandler(async (req, res) => {
  sendSuccess(res, 'SSL certificate status updated.', await provisionTenantSsl(req.adminScope, req));
}));

router.delete('/domain', asyncHandler(async (req, res) => {
  sendSuccess(res, 'Custom domain disabled and released.', await disableTenantDomain(req.adminScope, req));
}));

router.get('/courses/export', asyncHandler(async (req, res) => {
  const query = parse(courseExportQuerySchema, req.query);
  const dashboard = await getAdminDashboard(req.adminScope);
  const courses = query.status
    ? dashboard.courses.filter((course) => course.status === query.status)
    : dashboard.courses;
  const rows = [
    ['Code', 'Name', 'Credits', 'Faculty', 'Enrolled', 'Capacity', 'Status'],
    ...courses.map((course) => [
      course.code,
      course.name,
      course.credits,
      course.facultyName,
      course.enrolledCount,
      course.capacity,
      course.statusLabel,
    ]),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="department-courses.csv"');
  res.send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
}));

router.get('/courses', asyncHandler(async (req, res) => {
  const query = parse(courseListQuerySchema, req.query);
  sendSuccess(res, 'Department courses loaded.', await listAdminCourses(req.adminScope, query));
}));

router.post('/courses', asyncHandler(async (req, res) => {
  const input = parse(courseInputSchema, req.body);
  const course = await Course.create({
    ...input,
    code: input.code.toUpperCase(),
    institutionId: req.adminScope.institution._id,
    departmentId: req.adminScope.department._id,
    facultyName: 'Unassigned',
    schedule: '',
  });
  await recordAdminAudit(req, req.adminScope, {
    action: 'course.created',
    entityType: 'Course',
    entityId: course._id,
    before: null,
    after: course,
  });
  sendSuccess(res, 'Course created.', course, 201);
}));

router.patch('/courses/:id/status', asyncHandler(async (req, res) => {
  const input = parse(courseStatusSchema, req.body);
  const course = await requireScopedCourse(req, req.adminScope);
  if (!course) throw new AdminApiError(404, 'Course not found in this department.');
  const before = safeSnapshot(course);
  course.status = input.status;
  await course.save();
  await recordAdminAudit(req, req.adminScope, {
    action: 'course.status_updated',
    entityType: 'Course',
    entityId: course._id,
    before,
    after: course,
  });
  sendSuccess(res, 'Course status updated.', course);
}));

router.patch('/courses/:id', asyncHandler(async (req, res) => {
  const input = parse(coursePatchSchema, req.body);
  const course = await requireScopedCourse(req, req.adminScope);
  if (!course) throw new AdminApiError(404, 'Course not found in this department.');
  const before = safeSnapshot(course);
  Object.assign(course, input);
  if (input.code) course.code = input.code.toUpperCase();
  await course.save();
  await recordAdminAudit(req, req.adminScope, {
    action: 'course.updated',
    entityType: 'Course',
    entityId: course._id,
    before,
    after: course,
  });
  sendSuccess(res, 'Course updated.', course);
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  const { force } = parse(courseDeleteQuerySchema, req.query);
  const course = await requireScopedCourse(req, req.adminScope);
  if (!course) throw new AdminApiError(404, 'Course not found in this department.');
  const activeEnrollments = await Enrollment.countDocuments({
    courseId: course._id,
    status: 'enrolled',
  });
  if (activeEnrollments && !force) {
    throw new AdminApiError(409, 'The course has active enrollments. Retry with force=true to archive it.');
  }
  const before = safeSnapshot(course);
  course.status = 'archived';
  await course.save();
  await recordAdminAudit(req, req.adminScope, {
    action: 'course.archived',
    entityType: 'Course',
    entityId: course._id,
    before,
    after: course,
  });
  sendSuccess(res, 'Course archived.', course);
}));

router.put('/courses/:id/faculty', asyncHandler(async (req, res) => {
  const input = parse(courseFacultySchema, req.body);
  const course = await requireScopedCourse(req, req.adminScope);
  if (!course) throw new AdminApiError(404, 'Course not found in this department.');
  const requestedIds = [...new Set([
    ...input.facultyIds,
    ...(input.primaryFacultyId ? [input.primaryFacultyId] : []),
  ])];
  const facultyUsers = requestedIds.length
    ? await User.find({
      id: { $in: requestedIds },
      role: 'faculty',
      institutionId: req.adminScope.institution._id,
    })
    : [];
  const normalizedDepartment = normalizedName(req.adminScope.department.name);
  const eligible = facultyUsers.filter((faculty) => (
    faculty.departmentId
      ? String(faculty.departmentId) === String(req.adminScope.department._id)
      : normalizedName(faculty.department) === normalizedDepartment
        || normalizedName(faculty.department) === normalizedName(req.adminScope.department.code)
  ));
  if (eligible.length !== requestedIds.length) {
    throw new AdminApiError(400, 'Every selected faculty member must belong to this institution and department.');
  }

  const before = await CourseFaculty.find({ courseId: course._id, active: true })
    .populate('facultyId', 'id name').lean();
  await CourseFaculty.updateMany(
    { courseId: course._id, active: true },
    { $set: { active: false, removedAt: new Date() } }
  );
  const assignments = eligible.map((faculty) => ({
    courseId: course._id,
    facultyId: faculty._id,
    role: faculty.id === input.primaryFacultyId ? 'primary' : 'co-instructor',
    assignedBy: String(req.user.id),
  }));
  if (assignments.length) await CourseFaculty.insertMany(assignments);
  const primary = eligible.find((faculty) => faculty.id === input.primaryFacultyId);
  course.facultyName = primary?.name || 'Unassigned';
  course.facultyUserId = primary?.id || '';
  await course.save();
  const after = await CourseFaculty.find({ courseId: course._id, active: true })
    .populate('facultyId', 'id name').lean();
  await recordAdminAudit(req, req.adminScope, {
    action: 'course.faculty_allotted',
    entityType: 'CourseFaculty',
    entityId: course._id,
    before,
    after,
  });
  sendSuccess(res, 'Course faculty allotment updated.', {
    courseId: String(course._id),
    faculty: after.map((item) => ({
      id: String(item.facultyId.id || item.facultyId._id),
      name: item.facultyId.name,
      role: item.role,
    })),
  });
}));

router.get('/faculty', asyncHandler(async (req, res) => {
  const users = await User.find({
    role: 'faculty',
    institutionId: req.adminScope.institution._id,
  }).select('id name department departmentId').sort({ name: 1 }).lean();
  const department = normalizedName(req.adminScope.department.name);
  const departmentId = String(req.adminScope.department._id);
  sendSuccess(res, 'Faculty list loaded.', users.filter((user) => (
    user.departmentId
      ? String(user.departmentId) === departmentId
      : normalizedName(user.department) === department
        || normalizedName(user.department) === normalizedName(req.adminScope.department.code)
  )).map((user) => ({
    id: String(user.id || user._id),
    name: user.name,
    department: user.department,
  })));
}));

router.get('/courses/:id/enrollments', asyncHandler(async (req, res) => {
  const query = parse(enrollmentsQuerySchema, req.query);
  const course = await requireScopedCourse(req, req.adminScope);
  if (!course) throw new AdminApiError(404, 'Course not found in this department.');
  const filter = { courseId: course._id };
  const skip = (query.page - 1) * query.limit;
  const [total, enrollments] = await Promise.all([
    Enrollment.countDocuments(filter),
    Enrollment.find(filter).sort({ enrolledAt: -1 }).skip(skip).limit(query.limit).lean(),
  ]);
  sendSuccess(res, 'Course enrollments loaded.', {
    enrollments,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  });
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: error.issues[0]?.message || 'The request is invalid.',
      data: { issues: error.issues },
    });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: 'A resource with these details already exists.', data: null });
  }
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(`[Admin API] Request failed with status ${status}.`);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'The admin request could not be completed.' : error.message,
    data: null,
  });
});

export default router;
