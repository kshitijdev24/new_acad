import { jest } from '@jest/globals';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  AuditLog,
  Course,
  CourseFaculty,
  CustomDomain,
  Department,
  Enrollment,
  Institution,
  University,
  User,
} from '../models.js';
import {
  getAdminDashboard,
  recordAdminAudit,
} from '../services/adminDashboardService.js';
import {
  checkDomainDns,
  createTenantDomain,
  disableTenantDomain,
  normalizeAndValidateHostname,
  verifiedTenantMiddleware,
  verifyTenantDomain,
} from '../services/customDomainService.js';
import adminRouter from '../routes/adminRoutes.js';

const institutionA = { _id: new mongoose.Types.ObjectId(), name: 'Institution A' };
const departmentA = {
  _id: new mongoose.Types.ObjectId(),
  institutionId: institutionA._id,
  name: 'Computer Science and Engineering',
  code: 'CSE',
};
const tenantAdmin = {
  id: 'admin-a',
  role: 'admin',
  institutionId: institutionA._id,
  department: 'Computer Science and Engineering',
};

function queryResult(value) {
  const query = Promise.resolve(value);
  query.sort = () => query;
  query.skip = () => query;
  query.limit = () => query;
  query.select = () => query;
  query.populate = () => query;
  query.lean = () => Promise.resolve(value);
  return query;
}

function prepareTenantQueries() {
  jest.spyOn(Institution, 'findById').mockImplementation(() => queryResult(institutionA));
  jest.spyOn(Department, 'findOne').mockImplementation((filter) => (
    filter.$or ? queryResult(departmentA) : { sort: () => queryResult(departmentA) }
  ));
  jest.spyOn(User, 'updateOne').mockResolvedValue({});
}

function createTestApp(user = tenantAdmin) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/v1/admin', adminRouter);
  return app;
}

describe('admin dashboard validation and DNS verification', () => {
  afterEach(() => jest.restoreAllMocks());

  test('normalizes internationalized hostnames and rejects IPs, wildcards, invalid labels, and reserved domains', () => {
    expect(normalizeAndValidateHostname('münchen.example.edu')).toBe('xn--mnchen-3ya.example.edu');
    for (const hostname of [
      '192.0.2.4',
      '127.1',
      '2130706433',
      '0x7f000001',
      '2001:db8::1',
      '*.college.edu',
      'bad..college.edu',
      '-bad.college.edu',
      'portal.acadlytic-system.net',
      'www.example.com',
    ]) {
      expect(() => normalizeAndValidateHostname(hostname)).toThrow();
    }
  });

  test('verifies the expected CNAME and TXT record using the injected DNS resolver', async () => {
    const resolver = {
      resolveCname: jest.fn().mockResolvedValue(['cname.acadlytic-system.net.']),
      resolve4: jest.fn().mockResolvedValue(['192.0.2.10']),
      resolve6: jest.fn().mockRejectedValue(new Error('no AAAA record')),
      resolveTxt: jest.fn().mockResolvedValue([['acadlytic-verify=token-123']]),
    };
    await expect(checkDomainDns(
      'portal.college.edu',
      'acadlytic-verify=token-123',
      resolver,
      'cname.acadlytic-system.net'
    )).resolves.toEqual({ verified: true, error: null });
    expect(resolver.resolveCname).toHaveBeenCalledWith('portal.college.edu');
    expect(resolver.resolveTxt).toHaveBeenCalledWith('_acadlytic-verify.portal.college.edu');
  });

  test('reports an incorrect CNAME target and missing TXT record', async () => {
    const wrongTargetResolver = {
      resolveCname: jest.fn().mockResolvedValue(['attacker.example.net']),
      resolveTxt: jest.fn(),
    };
    await expect(checkDomainDns(
      'portal.college.edu',
      'token',
      wrongTargetResolver,
      'cname.acadlytic-system.net'
    )).resolves.toMatchObject({
      verified: false,
      error: 'CNAME points to attacker.example.net, expected cname.acadlytic-system.net.',
    });
    expect(wrongTargetResolver.resolveTxt).not.toHaveBeenCalled();

    const missingTxtResolver = {
      resolveCname: jest.fn().mockResolvedValue(['cname.acadlytic-system.net']),
      resolve4: jest.fn().mockResolvedValue(['192.0.2.10']),
      resolve6: jest.fn().mockRejectedValue(new Error('no AAAA record')),
      resolveTxt: jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENODATA' })),
    };
    await expect(checkDomainDns(
      'portal.college.edu',
      'token',
      missingTxtResolver,
      'cname.acadlytic-system.net'
    )).resolves.toMatchObject({
      verified: false,
      error: 'The required TXT verification record could not be found.',
    });

    await expect(checkDomainDns(
      'portal.college.edu',
      'token',
      {
        resolveCname: jest.fn().mockResolvedValue(['cname.acadlytic-system.net']),
        resolve4: jest.fn().mockRejectedValue(new Error('no A record')),
        resolve6: jest.fn().mockRejectedValue(new Error('no AAAA record')),
        resolveTxt: jest.fn(),
      },
      'cname.acadlytic-system.net'
    )).resolves.toMatchObject({
      verified: false,
      error: 'CNAME target cname.acadlytic-system.net does not resolve to an address.',
    });
  });

  test('rejects a domain already claimed by another tenant before creating it', async () => {
    jest.spyOn(CustomDomain, 'findOne').mockResolvedValue({ institutionId: new mongoose.Types.ObjectId() });
    const req = { ip: '127.0.0.1', get: () => '' };
    await expect(createTenantDomain(
      { institution: institutionA },
      tenantAdmin,
      'portal.college.edu',
      req
    )).rejects.toMatchObject({ status: 409 });
  });

  test('creates a new domain in pending state and never audits its verification token', async () => {
    const domainId = new mongoose.Types.ObjectId();
    const created = {
      _id: domainId,
      domain: 'portal.college.edu',
      status: 'pending_verification',
      recordType: 'CNAME',
      target: 'cname.acadlytic-system.net',
      verificationType: 'TXT',
      verificationToken: 'acadlytic-verify:private-token',
      verification: {},
      ssl: { status: 'none' },
      lastCheckedAt: null,
      lastError: null,
      toObject() {
        return {
          _id: this._id,
          domain: this.domain,
          status: this.status,
          verificationToken: this.verificationToken,
        };
      },
    };
    jest.spyOn(CustomDomain, 'findOne').mockResolvedValue(null);
    jest.spyOn(CustomDomain, 'create').mockResolvedValue(created);
    const createAudit = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const req = { ip: '127.0.0.1', get: () => 'test-agent' };

    const result = await createTenantDomain(
      { institution: institutionA },
      tenantAdmin,
      'portal.college.edu',
      req
    );

    expect(result).toMatchObject({
      domain: 'portal.college.edu',
      status: 'pending_verification',
      target: 'cname.acadlytic-system.net',
    });
    expect(result.verification.value).toBe('acadlytic-verify:private-token');
    expect(createAudit).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.not.objectContaining({ verificationToken: expect.anything() }),
    }));
  });

  test('moves pending domains to active only after both DNS records pass', async () => {
    const domain = {
      _id: new mongoose.Types.ObjectId(),
      institutionId: institutionA._id,
      domain: 'verify.college.edu',
      status: 'pending_verification',
      target: 'cname.acadlytic-system.net',
      verificationType: 'TXT',
      verificationToken: 'token-456',
      verifiedAt: null,
      ssl: { status: 'none' },
      lastCheckedAt: null,
      lastError: null,
      consecutiveDnsFailures: 0,
      failureNotifiedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          _id: this._id,
          domain: this.domain,
          status: this.status,
          verificationToken: this.verificationToken,
        };
      },
    };
    jest.spyOn(CustomDomain, 'findOne').mockReturnValue({
      select: () => Promise.resolve(domain),
    });
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const resolver = {
      resolveCname: jest.fn().mockResolvedValue(['cname.acadlytic-system.net']),
      resolve4: jest.fn().mockResolvedValue(['192.0.2.10']),
      resolve6: jest.fn().mockRejectedValue(new Error('no AAAA record')),
      resolveTxt: jest.fn().mockResolvedValue([['token-456']]),
    };

    const result = await verifyTenantDomain(
      { institution: institutionA },
      { user: tenantAdmin, ip: '127.0.0.1', get: () => '' },
      resolver
    );
    expect(result.status).toBe('active');
    expect(domain.verifiedAt).toBeInstanceOf(Date);
    expect(domain.save).toHaveBeenCalledTimes(2);
  });

  test('does not activate a domain when DNS verification fails', async () => {
    const domain = {
      _id: new mongoose.Types.ObjectId(),
      institutionId: institutionA._id,
      domain: 'failed.college.edu',
      status: 'pending_verification',
      target: 'cname.acadlytic-system.net',
      verificationType: 'TXT',
      verificationToken: 'token-789',
      verifiedAt: null,
      ssl: { status: 'none' },
      lastCheckedAt: null,
      lastError: null,
      consecutiveDnsFailures: 0,
      failureNotifiedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          _id: this._id,
          domain: this.domain,
          status: this.status,
          verificationToken: this.verificationToken,
        };
      },
    };
    jest.spyOn(CustomDomain, 'findOne').mockReturnValue({
      select: () => Promise.resolve(domain),
    });
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const resolver = {
      resolveCname: jest.fn().mockResolvedValue(['wrong.target.net']),
      resolve4: jest.fn(),
      resolve6: jest.fn(),
      resolveTxt: jest.fn(),
    };

    const result = await verifyTenantDomain(
      { institution: institutionA },
      { user: tenantAdmin, ip: '127.0.0.1', get: () => '' },
      resolver
    );
    expect(result.status).toBe('failed');
    expect(result.lastError).toContain('CNAME points to wrong.target.net');
    expect(domain.verifiedAt).toBeNull();
  });

  test('releases a domain without invalidating its required verification token', async () => {
    const domain = {
      _id: new mongoose.Types.ObjectId(),
      institutionId: institutionA._id,
      domain: 'released.college.edu',
      status: 'active',
      verificationType: 'TXT',
      verificationToken: 'acadlytic-verify:retained-token',
      releasedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          _id: this._id,
          domain: this.domain,
          status: this.status,
          verificationToken: this.verificationToken,
          releasedAt: this.releasedAt,
        };
      },
    };
    jest.spyOn(CustomDomain, 'findOne').mockReturnValue({
      select: () => Promise.resolve(domain),
    });
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});

    const result = await disableTenantDomain(
      { institution: institutionA },
      { user: tenantAdmin, ip: '127.0.0.1', get: () => '' }
    );

    expect(domain.status).toBe('disabled');
    expect(domain.verificationToken).toBe('acadlytic-verify:retained-token');
    expect(result.verification.value).toBe('');
    expect(domain.save).toHaveBeenCalledTimes(1);
  });

  test('tenant host routing refuses unverified hosts and resolves active verified hosts', async () => {
    const app = express();
    app.use(verifiedTenantMiddleware);
    app.get('/tenant', (req, res) => res.json({ institutionId: req.tenantInstitutionId }));
    jest.spyOn(CustomDomain, 'findOne').mockImplementation((filter) => ({
      select: () => ({
        lean: async () => filter.domain === 'verified.college.edu'
          ? { institutionId: institutionA._id }
          : null,
      }),
    }));

    const unverified = await request(app).get('/tenant').set('Host', 'unverified.college.edu');
    const verified = await request(app).get('/tenant').set('Host', 'verified.college.edu');
    expect(unverified.status).toBe(421);
    expect(verified.body.institutionId).toBe(String(institutionA._id));
  });
});

describe('admin route tenant isolation and reporting', () => {
  const previousReadyState = mongoose.connection.readyState;

  beforeEach(() => {
    mongoose.connection.readyState = 1;
    prepareTenantQueries();
  });

  afterEach(() => {
    mongoose.connection.readyState = previousReadyState;
    jest.restoreAllMocks();
  });

  test('blocks non-admin roles before querying tenant data', async () => {
    const findInstitution = jest.spyOn(Institution, 'findById');
    const response = await request(createTestApp({ ...tenantAdmin, role: 'student' }))
      .get('/api/v1/admin/dashboard');
    expect(response.status).toBe(403);
    expect(findInstitution).not.toHaveBeenCalled();
  });

  test('admin A cannot read or modify a course belonging to institution B', async () => {
    const courseId = new mongoose.Types.ObjectId().toString();
    const findCourse = jest.spyOn(Course, 'findOne').mockResolvedValue(null);
    const updateAudit = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const app = createTestApp();

    const readResponse = await request(app)
      .get(`/api/v1/admin/courses/${courseId}/enrollments`);
    const updateResponse = await request(app)
      .patch(`/api/v1/admin/courses/${courseId}`)
      .send({ name: 'Changed by another tenant' });

    expect(readResponse.status).toBe(404);
    expect(updateResponse.status).toBe(404);
    expect(findCourse).toHaveBeenCalledTimes(2);
    for (const [filter] of findCourse.mock.calls) {
      expect(String(filter.institutionId)).toBe(String(institutionA._id));
      expect(String(filter.departmentId)).toBe(String(departmentA._id));
    }
    expect(updateAudit).not.toHaveBeenCalled();
  });

  test('returns enrolled counts from one grouped enrollment aggregation', async () => {
    const courseId = new mongoose.Types.ObjectId();
    const course = {
      _id: courseId,
      code: 'CS301',
      name: 'Algorithms',
      credits: 4,
      capacity: 70,
      status: 'active',
    };
    jest.spyOn(Institution, 'findById').mockImplementation(() => queryResult({
      ...institutionA,
      universityId: new mongoose.Types.ObjectId(),
      shortName: 'IA',
      city: 'New Delhi',
      accreditations: [],
    }));
    jest.spyOn(Department, 'findById').mockImplementation(() => queryResult(departmentA));
    jest.spyOn(University, 'findById').mockImplementation(() => queryResult({
      name: 'Example University',
      shortName: 'EU',
    }));
    jest.spyOn(Course, 'find').mockImplementation(() => queryResult([course]));
    jest.spyOn(CustomDomain, 'findOne').mockImplementation(() => queryResult(null));
    jest.spyOn(CourseFaculty, 'find').mockImplementation(() => queryResult([]));
    const aggregate = jest.spyOn(Enrollment, 'aggregate').mockResolvedValue([
      { _id: courseId, enrolledCount: 64 },
    ]);

    const dashboard = await getAdminDashboard({
      institution: institutionA,
      department: departmentA,
    });

    expect(dashboard.courses[0]).toMatchObject({
      code: 'CS301',
      facultyName: 'Unassigned',
      enrolledCount: 64,
      statusLabel: 'Active Curriculum',
    });
    expect(dashboard.stats).toEqual({ totalCourses: 1, totalEnrolled: 64, unassignedCourses: 1 });
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(aggregate.mock.calls[0][0]).toContainEqual({
      $group: { _id: '$courseId', enrolledCount: { $sum: 1 } },
    });
  });

  test('rejects faculty allotment outside the department and does not change assignments', async () => {
    const course = {
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn(),
    };
    jest.spyOn(Course, 'findOne').mockResolvedValue(course);
    jest.spyOn(User, 'find').mockResolvedValue([]);
    const updateAssignments = jest.spyOn(CourseFaculty, 'updateMany');
    const response = await request(createTestApp())
      .put(`/api/v1/admin/courses/${course._id}/faculty`)
      .send({ facultyIds: ['faculty-from-other-tenant'], primaryFacultyId: 'faculty-from-other-tenant' });

    expect(response.status).toBe(400);
    expect(updateAssignments).not.toHaveBeenCalled();
    expect(course.save).not.toHaveBeenCalled();
  });

  test('writes audit records with sensitive token fields removed', async () => {
    const createAudit = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const req = {
      user: { id: 'admin-a' },
      ip: '127.0.0.1',
      get: () => 'test-agent',
    };
    await recordAdminAudit(req, { institution: institutionA }, {
      action: 'domain.created',
      entityType: 'CustomDomain',
      entityId: 'domain-a',
      before: null,
      after: { domain: 'portal.college.edu', verificationToken: 'must-not-be-saved' },
    });

    expect(createAudit).toHaveBeenCalledWith(expect.objectContaining({
      institutionId: institutionA._id,
      actorId: 'admin-a',
      after: { domain: 'portal.college.edu' },
    }));
  });
});
