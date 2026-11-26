import { promises as dns } from 'node:dns';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import nodemailer from 'nodemailer';
import { domainToASCII } from 'node:url';
import {
  AuditLog,
  CustomDomain,
  Institution,
  User,
} from '../models.js';
import { AdminApiError, sanitizeAuditValue } from './adminDashboardService.js';
import { getSslProvider } from './sslProviders.js';

const DOMAIN_CACHE_TTL_MS = 60 * 1000;
const domainCache = new Map();
let emailTransporter;
let emailTransporterUrl;
let maintenanceRunning = false;

function normalizeDnsName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function isIpAddressOrLiteral(hostname) {
  if (net.isIP(hostname)) return true;
  try {
    return net.isIP(new URL(`http://${hostname}`).hostname.replace(/^\[|\]$/g, '')) !== 0;
  } catch {
    return false;
  }
}

export function normalizeAndValidateHostname(input) {
  const raw = String(input || '').trim().replace(/\.$/, '');
  if (!raw || raw.includes('*') || raw.includes('/') || raw.includes(':') || isIpAddressOrLiteral(raw)) {
    throw new AdminApiError(400, 'Enter a public hostname without a wildcard, port, or IP address.');
  }
  const hostname = domainToASCII(raw).toLowerCase();
  if (!hostname || hostname.length > 253 || isIpAddressOrLiteral(hostname)) {
    throw new AdminApiError(400, 'Enter a valid RFC 1123 hostname.');
  }
  const labels = hostname.split('.');
  if (
    labels.length < 2
    || labels.some((label) => label.length < 1 || label.length > 63
      || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  ) {
    throw new AdminApiError(400, 'Enter a valid RFC 1123 hostname.');
  }
  const reserved = new Set([
    'localhost',
    'local',
    'example.com',
    'acadlytic.com',
    'acadlytic-system.net',
    ...(process.env.PLATFORM_RESERVED_DOMAINS || '')
      .split(',')
      .map((item) => domainToASCII(item.trim().replace(/^\*\./, '')).toLowerCase())
      .filter(Boolean),
  ]);
  if ([...reserved].some((item) => hostname === item || hostname.endsWith(`.${item}`))) {
    throw new AdminApiError(400, 'This platform-owned or reserved domain cannot be configured.');
  }
  return hostname;
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function checkDomainDns(domain, verificationToken, resolver = dns, expectedTarget) {
  const target = normalizeDnsName(
    expectedTarget || process.env.PLATFORM_CNAME_TARGET || 'cname.acadlytic-system.net'
  );
  let cnameRecords;
  try {
    cnameRecords = await withTimeout(resolver.resolveCname(domain), 5000);
  } catch (error) {
    if (error.message === 'DNS lookup timed out.') {
      return { verified: false, error: 'The CNAME lookup timed out. Check the DNS record and try again.' };
    }
    return { verified: false, error: 'The required CNAME record could not be found.' };
  }
  const actualTarget = (cnameRecords || []).map(normalizeDnsName).find(Boolean);
  if (!actualTarget) {
    return { verified: false, error: 'The required CNAME record could not be found.' };
  }
  if (actualTarget !== target) {
    return {
      verified: false,
      error: `CNAME points to ${actualTarget}, expected ${target}.`,
    };
  }
  const addressLookups = ['resolve4', 'resolve6'].map((method) => withTimeout(
    Promise.resolve().then(() => resolver[method](target)),
    5000
  ).then((records) => {
    if (!records?.length) throw new Error('No DNS address records found.');
    return true;
  }));
  try {
    await Promise.any(addressLookups);
  } catch {
    return {
      verified: false,
      error: `CNAME target ${target} does not resolve to an address.`,
    };
  }

  const verificationHost = `_acadlytic-verify.${domain}`;
  let txtRecords;
  try {
    txtRecords = await withTimeout(resolver.resolveTxt(verificationHost), 5000);
  } catch (error) {
    return {
      verified: false,
      error: error.message === 'DNS lookup timed out.'
        ? 'The TXT verification lookup timed out. Check the DNS record and try again.'
        : 'The required TXT verification record could not be found.',
    };
  }
  const values = (txtRecords || []).map((parts) => parts.join(''));
  if (!values.includes(verificationToken) && !values.includes(`acadlytic-verify=${verificationToken}`)) {
    return { verified: false, error: 'The TXT record was found, but its verification value did not match.' };
  }
  return { verified: true, error: null };
}

function domainSnapshot(domain) {
  if (!domain) return null;
  const value = typeof domain.toObject === 'function' ? domain.toObject() : domain;
  return sanitizeAuditValue(value);
}

function publicDomain(domain) {
  if (!domain) return null;
  return {
    domain: domain.domain,
    status: domain.status,
    recordType: domain.recordType,
    target: domain.target,
    verification: {
      type: domain.verificationType,
      host: `_acadlytic-verify.${domain.domain}`,
      value: domain.releasedAt ? '' : domain.verificationToken,
      verifiedAt: domain.verifiedAt,
    },
    ssl: {
      status: domain.ssl?.status || 'none',
      protocol: domain.ssl?.protocol || '',
      issuer: domain.ssl?.issuer || '',
      expiresAt: domain.ssl?.expiresAt || null,
      autoRenew: Boolean(domain.ssl?.autoRenew),
    },
    lastCheckedAt: domain.lastCheckedAt || null,
    lastError: domain.lastError || null,
  };
}

export async function getTenantDomain(scope) {
  const domain = await CustomDomain.findOne({
    institutionId: scope.institution._id,
    releasedAt: { $exists: false },
  }).select('+verificationToken');
  return publicDomain(domain);
}

function cryptoRandomToken() {
  return randomBytes(24).toString('hex');
}

async function findTenantDomain(scope) {
  const domain = await CustomDomain.findOne({
    institutionId: scope.institution._id,
    releasedAt: { $exists: false },
  }).select('+verificationToken +providerCertificateId');
  if (!domain) throw new AdminApiError(404, 'No custom domain is configured for this institution.');
  return domain;
}

async function notifyInstitutionAdmins(domain, failureReason) {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    console.warn('[Admin domain] Repeated DNS failure notification skipped: SMTP_URL is not configured.');
    return false;
  }
  const institution = await Institution.findById(domain.institutionId).select('name').lean();
  const admins = await User.find({
    institutionId: domain.institutionId,
    role: 'admin',
  }).select('email').lean();
  const recipients = [...new Set([
    ...admins.map((admin) => admin.email).filter(Boolean),
    ...(process.env.ADMIN_NOTIFICATION_EMAIL || '').split(',').map((email) => email.trim()).filter(Boolean),
  ])];
  if (!recipients.length) return false;

  if (emailTransporterUrl !== smtpUrl) {
    emailTransporter = nodemailer.createTransport(smtpUrl);
    emailTransporterUrl = smtpUrl;
  }
  try {
    await emailTransporter.sendMail({
      from: process.env.MAIL_FROM || 'Acadlytic Domain Monitor <no-reply@acadlytic.invalid>',
      to: recipients,
      subject: `Custom domain verification failed for ${domain.domain}`,
      text: [
        `Institution: ${institution?.name || 'Your institution'}`,
        `Domain: ${domain.domain}`,
        `Reason: ${failureReason}`,
        'The domain has been disabled for tenant routing until DNS verification succeeds.',
      ].join('\n'),
    });
    return true;
  } catch {
    console.error('[Admin domain] Repeated DNS failure email could not be sent.');
    return false;
  }
}

export async function createTenantDomain(scope, user, rawDomain, req) {
  const domainName = normalizeAndValidateHostname(rawDomain);
  const configuredTarget = domainToASCII(
    (process.env.PLATFORM_CNAME_TARGET || 'cname.acadlytic-system.net').trim().replace(/\.$/, '')
  ).toLowerCase();
  if (
    !configuredTarget
    || isIpAddressOrLiteral(configuredTarget)
    || configuredTarget.length > 253
    || configuredTarget.split('.').some((label) => (
      label.length < 1
      || label.length > 63
      || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ))
  ) {
    throw new AdminApiError(500, 'PLATFORM_CNAME_TARGET must be a valid hostname.');
  }
  const existing = await CustomDomain.findOne({
    domain: domainName,
    releasedAt: { $exists: false },
  });
  if (existing) {
    throw new AdminApiError(409, 'This domain is already claimed by an institution.');
  }
  const current = await CustomDomain.findOne({
    institutionId: scope.institution._id,
    releasedAt: { $exists: false },
  });
  if (current) {
    throw new AdminApiError(409, 'Disable the institution’s current domain before configuring another.');
  }

  const domain = await CustomDomain.create({
    institutionId: scope.institution._id,
    domain: domainName,
    status: 'pending_verification',
    recordType: 'CNAME',
    target: configuredTarget,
    verificationToken: `acadlytic-verify=${cryptoRandomToken()}`,
    verificationType: 'TXT',
    createdBy: String(user.id),
  });
  await AuditLog.create({
    institutionId: scope.institution._id,
    actorId: String(user.id),
    action: 'domain.created',
    entityType: 'CustomDomain',
    entityId: String(domain._id),
    before: null,
    after: domainSnapshot(domain),
    ip: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
  });
  clearDomainCache(domainName);
  return publicDomain(domain);
}

export async function verifyTenantDomain(scope, req, resolver = dns, isBackground = false) {
  const domain = await findTenantDomain(scope);
  const before = domainSnapshot(domain);
  if (domain.status !== 'active') {
    domain.status = 'verifying';
    await domain.save();
  }
  const result = await checkDomainDns(domain.domain, domain.verificationToken, resolver, domain.target);
  domain.lastCheckedAt = new Date();
  if (result.verified) {
    domain.status = 'active';
    domain.verifiedAt = new Date();
    domain.lastError = null;
    domain.consecutiveDnsFailures = 0;
    domain.failureNotifiedAt = null;
  } else {
    domain.status = 'failed';
    domain.verifiedAt = null;
    domain.lastError = result.error;
    domain.consecutiveDnsFailures += 1;
  }
  await domain.save();
  clearDomainCache(domain.domain);

  if (!result.verified && domain.consecutiveDnsFailures >= 3 && !domain.failureNotifiedAt) {
    if (await notifyInstitutionAdmins(domain, result.error)) {
      domain.failureNotifiedAt = new Date();
      await domain.save();
    }
  }
  if (isBackground) {
    await AuditLog.create({
      institutionId: scope.institution._id,
      actorId: 'system:domain-monitor',
      action: result.verified ? 'domain.dns_reverified' : 'domain.dns_verification_failed',
      entityType: 'CustomDomain',
      entityId: String(domain._id),
      before,
      after: domainSnapshot(domain),
      ip: '',
      userAgent: '',
    });
  } else if (req) {
    await AuditLog.create({
      institutionId: scope.institution._id,
      actorId: String(req.user.id),
      action: result.verified ? 'domain.verified' : 'domain.verification_failed',
      entityType: 'CustomDomain',
      entityId: String(domain._id),
      before,
      after: domainSnapshot(domain),
      ip: String(req.ip || '').slice(0, 64),
      userAgent: String(req.get('user-agent') || '').slice(0, 500),
    });
  }
  return publicDomain(domain);
}

export async function provisionTenantSsl(scope, req) {
  const domain = await findTenantDomain(scope);
  if (domain.status !== 'active' || !domain.verifiedAt) {
    throw new AdminApiError(409, 'Verify the domain DNS records before provisioning SSL.');
  }
  const before = domainSnapshot(domain);
  domain.ssl.status = 'provisioning';
  domain.lastError = null;
  await domain.save();
  try {
    const certificate = await getSslProvider().provision(domain);
    domain.ssl.status = certificate.status;
    domain.ssl.issuer = certificate.issuer || '';
    domain.ssl.expiresAt = certificate.expiresAt || null;
    domain.ssl.protocol = certificate.protocol || '';
    domain.ssl.autoRenew = Boolean(certificate.autoRenew);
    if (certificate.lastRenewedAt) domain.ssl.lastRenewedAt = certificate.lastRenewedAt;
    else if (certificate.status === 'active' && !domain.ssl.lastRenewedAt) {
      domain.ssl.lastRenewedAt = new Date();
    }
    if (certificate.providerCertificateId) domain.providerCertificateId = certificate.providerCertificateId;
    domain.lastError = certificate.lastError || null;
    await domain.save();
  } catch (error) {
    domain.ssl.status = 'failed';
    domain.lastError = error.message || 'The SSL provider could not provision a certificate.';
    await domain.save();
    await AuditLog.create({
      institutionId: scope.institution._id,
      actorId: String(req.user.id),
      action: 'domain.ssl_provision_failed',
      entityType: 'CustomDomain',
      entityId: String(domain._id),
      before,
      after: domainSnapshot(domain),
      ip: String(req.ip || '').slice(0, 64),
      userAgent: String(req.get('user-agent') || '').slice(0, 500),
    });
    clearDomainCache(domain.domain);
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(502, domain.lastError);
  }
  await AuditLog.create({
    institutionId: scope.institution._id,
    actorId: String(req.user.id),
    action: 'domain.ssl_provisioned',
    entityType: 'CustomDomain',
    entityId: String(domain._id),
    before,
    after: domainSnapshot(domain),
    ip: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
  });
  return publicDomain(domain);
}

export async function disableTenantDomain(scope, req) {
  const domain = await findTenantDomain(scope);
  const before = domainSnapshot(domain);
  domain.status = 'disabled';
  domain.releasedAt = new Date();
  await domain.save();
  await AuditLog.create({
    institutionId: scope.institution._id,
    actorId: String(req.user.id),
    action: 'domain.disabled',
    entityType: 'CustomDomain',
    entityId: String(domain._id),
    before,
    after: domainSnapshot(domain),
    ip: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
  });
  clearDomainCache(domain.domain);
  return publicDomain(domain);
}

function clearDomainCache(domain) {
  if (domain) domainCache.delete(normalizeDnsName(domain));
}

export async function resolveTenantDomain(hostname) {
  const host = normalizeDnsName(hostname);
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.institutionId;
  domainCache.delete(host);

  const domain = await CustomDomain.findOne({
    domain: host,
    status: 'active',
    verifiedAt: { $ne: null },
    releasedAt: { $exists: false },
  }).select('institutionId').lean();
  const institutionId = domain ? String(domain.institutionId) : null;
  if (domainCache.size >= 2000) domainCache.delete(domainCache.keys().next().value);
  domainCache.set(host, { institutionId, expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS });
  return institutionId;
}

function parseHostname(host) {
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isPlatformHost(hostname) {
  const configured = (process.env.PLATFORM_ALLOWED_HOSTS || 'localhost,127.0.0.1,::1')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const baseDomain = normalizeDnsName(process.env.PLATFORM_BASE_DOMAIN || 'acadlytic-system.net');
  return configured.includes(hostname)
    || hostname === baseDomain
    || hostname.endsWith(`.${baseDomain}`);
}

export async function verifiedTenantMiddleware(req, res, next) {
  try {
    const hostname = parseHostname(req.get('host') || '');
    let requestInstitutionId = null;
    if (!isPlatformHost(hostname)) {
      requestInstitutionId = await resolveTenantDomain(hostname);
      if (!requestInstitutionId) {
        return res.status(421).json({
          success: false,
          message: 'This host is not an active, DNS-verified Acadlytic domain.',
          data: null,
        });
      }
    }
    req.tenantInstitutionId = requestInstitutionId;

    const origin = req.get('origin');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).hostname.toLowerCase();
      } catch {
        return res.status(403).json({ success: false, message: 'The request origin is not allowed.', data: null });
      }
      const originAllowed = originHost === hostname
        || isPlatformHost(originHost)
        || Boolean(await resolveTenantDomain(originHost));
      if (!originAllowed) {
        if (req.method === 'OPTIONS') {
          return res.status(403).json({ success: false, message: 'The request origin is not allowed.', data: null });
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') return res.status(204).end();
      }
    }
    return next();
  } catch (error) {
    console.error('[Tenant resolver] Unable to resolve request host.');
    return res.status(503).json({
      success: false,
      message: 'Tenant routing is temporarily unavailable.',
      data: null,
    });
  }
}

export async function runDomainMaintenance() {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    const domains = await CustomDomain.find({
      status: { $in: ['active', 'failed'] },
      releasedAt: { $exists: false },
    }).select('institutionId');
    for (const domain of domains) {
      try {
        const institution = await Institution.findById(domain.institutionId);
        if (!institution) continue;
        const scope = { institution, department: null };
        await verifyTenantDomain(scope, null, dns, true);

        const certificate = await CustomDomain.findOne({
          _id: domain._id,
          status: 'active',
        }).select('+providerCertificateId');
        if (
          certificate
          && (['provisioning', 'failed'].includes(certificate.ssl.status)
            || (certificate.ssl.expiresAt
              && certificate.ssl.expiresAt.getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000))
        ) {
          const before = domainSnapshot(certificate);
          try {
            const providerResult = await getSslProvider().provision(certificate);
            certificate.ssl.status = providerResult.status;
            certificate.ssl.issuer = providerResult.issuer || certificate.ssl.issuer;
            certificate.ssl.expiresAt = providerResult.expiresAt || certificate.ssl.expiresAt;
            certificate.ssl.protocol = providerResult.protocol || certificate.ssl.protocol;
            certificate.ssl.autoRenew = Boolean(providerResult.autoRenew);
            certificate.lastError = providerResult.lastError || null;
            if (providerResult.providerCertificateId) {
              certificate.providerCertificateId = providerResult.providerCertificateId;
            }
          } catch (error) {
            certificate.ssl.status = 'failed';
            certificate.lastError = error.message || 'The SSL provider could not renew the certificate.';
          }
          await certificate.save();
          await AuditLog.create({
            institutionId: certificate.institutionId,
            actorId: 'system:domain-monitor',
            action: certificate.ssl.status === 'failed'
              ? 'domain.ssl_renewal_failed'
              : 'domain.ssl_renewal_checked',
            entityType: 'CustomDomain',
            entityId: String(certificate._id),
            before,
            after: domainSnapshot(certificate),
            ip: '',
            userAgent: '',
          });
        }
      } catch {
        console.error('[Admin domain] Scheduled DNS or SSL maintenance failed.');
      }
    }
  } finally {
    maintenanceRunning = false;
  }
}

export function startDomainMaintenance() {
  const timer = setInterval(() => {
    runDomainMaintenance().catch(() => {
      console.error('[Admin domain] Scheduled maintenance could not complete.');
    });
  }, 6 * 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
