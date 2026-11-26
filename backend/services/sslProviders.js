function cloudflareConfig() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) {
    throw new Error('Cloudflare SSL requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.');
  }
  return { token, zoneId };
}

async function cloudflareRequest(path, { method = 'GET', body } = {}) {
  const { token, zoneId } = cloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/custom_hostnames${path}`,
    {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result.result) {
    throw new Error('The configured SSL provider could not provision this certificate.');
  }
  return result.result;
}

function mapCloudflareCertificate(result) {
  const ssl = result.ssl || {};
  const sslStatus = ssl.status === 'active'
    ? 'active'
    : ['pending_validation', 'pending_issuance', 'pending_deployment'].includes(ssl.status)
      ? 'provisioning'
      : 'failed';
  return {
    providerCertificateId: result.id,
    status: sslStatus,
    issuer: ssl.certificate_authority || (sslStatus === 'active' ? 'Cloudflare' : ''),
    expiresAt: ssl.expires_on ? new Date(ssl.expires_on) : null,
    protocol: sslStatus === 'active' ? 'TLS 1.3' : '',
    autoRenew: true,
    lastError: sslStatus === 'failed' ? 'The SSL provider reported a certificate failure.' : null,
  };
}

const stubProvider = {
  async provision() {
    return {
      providerCertificateId: undefined,
      status: 'active',
      issuer: 'Acadlytic Development Certificate',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      protocol: 'TLS 1.3',
      autoRenew: true,
      lastRenewedAt: new Date(),
      lastError: null,
    };
  },
};

const cloudflareProvider = {
  async provision(domain) {
    const result = domain.providerCertificateId
      ? await cloudflareRequest(`/${encodeURIComponent(domain.providerCertificateId)}`)
      : await cloudflareRequest('', {
        method: 'POST',
        body: {
          hostname: domain.domain,
          ssl: { method: 'http', type: 'dv' },
        },
      });
    return mapCloudflareCertificate(result);
  },
};

export function getSslProvider() {
  const providerName = (process.env.SSL_PROVIDER || 'stub').trim().toLowerCase();
  if (providerName === 'stub') return stubProvider;
  if (providerName === 'cloudflare') return cloudflareProvider;
  throw new Error(`Unsupported SSL_PROVIDER "${providerName}". Use "stub" or "cloudflare".`);
}
