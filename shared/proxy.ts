export type Scheme = 'http' | 'https' | 'socks4' | 'socks5';

export type Profile = {
  id: string;
  name: string;
  scheme: Scheme;
  host: string;
  port: number;
  username: string;
  password: string;
};

export type Rule = {
  id: string;
  pattern: string;
  profileId: string;
};

export type Settings = {
  enabled: boolean;
  defaultProfileId: string;
  profiles: Profile[];
  rules: Rule[];
  blockWebRtcLeak: boolean;
};

export type DiagnosisKind = 'port' | 'protocol' | 'auth' | 'tunnel' | 'target' | 'unknown';

export type Diagnosis = {
  kind: DiagnosisKind;
  title: string;
  detail: string;
};

export type Decision = {
  profileId: string;
  profile: Profile | null;
  reason: string;
};

const SCHEMES = new Set<Scheme>(['http', 'https', 'socks4', 'socks5']);

export function emptySettings(): Settings {
  return {enabled: false, defaultProfileId: 'direct', profiles: [], rules: [], blockWebRtcLeak: true};
}

export function webRtcPolicy(settings: Settings): 'disable_non_proxied_udp' | 'default' {
  return settings.enabled && settings.blockWebRtcLeak ? 'disable_non_proxied_udp' : 'default';
}

export function chromeCanAuthenticate(scheme: Scheme): boolean {
  return scheme === 'http' || scheme === 'https';
}

export function normalizeHost(host: string): string {
  return host.trim().replace(/\.$/, '').toLowerCase();
}

export function isLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  if (h === 'localhost' || h === '::1') return true;
  if (!h.includes('.')) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function patternMatches(host: string, pattern: string): boolean {
  const h = normalizeHost(host);
  const p = pattern.trim().toLowerCase();
  if (p === '*') return true;
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return h === base || h.endsWith('.' + base);
  }
  return h === p || h.endsWith('.' + p);
}

export function validatePattern(pattern: string): string | null {
  const p = pattern.trim().toLowerCase();
  if (p === '*') return null;
  const body = p.startsWith('*.') ? p.slice(2) : p;
  if (!/^[a-z0-9.-]+$/.test(body) || body.startsWith('.') || body.endsWith('.') || body.includes('..')) {
    return 'Domain accepts letters, numbers, dots, and an optional *. prefix.';
  }
  return null;
}

function validProxyHost(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) {
    return /^[0-9a-f:]+$/i.test(host.slice(1, -1));
  }
  return /^[A-Za-z0-9.-]+$/.test(host) && !host.startsWith('.') && !host.endsWith('.') && !host.includes('..');
}

export function parseProxyLine(line: string): Omit<Profile, 'id' | 'name'> | {error: string} {
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) return {error: 'Empty line'};
  let scheme: Scheme = 'http';
  let rest = raw;
  const schemeMatch = raw.match(/^(https?|socks4|socks5|socks):\/\//i);
  if (schemeMatch) {
    const token = schemeMatch[1].toLowerCase();
    scheme = token === 'socks' ? 'socks5' : (token as Scheme);
    rest = raw.slice(schemeMatch[0].length);
  }
  let username = '';
  let password = '';
  const at = rest.lastIndexOf('@');
  if (at >= 0) {
    const auth = rest.slice(0, at);
    rest = rest.slice(at + 1);
    const colon = auth.indexOf(':');
    username = decodeURIComponent(colon >= 0 ? auth.slice(0, colon) : auth);
    password = colon >= 0 ? decodeURIComponent(auth.slice(colon + 1)) : '';
  }
  const portMatch = rest.match(/:(\d+)$/);
  if (!portMatch) return {error: 'Missing port'};
  const port = Number(portMatch[1]);
  const host = rest.slice(0, -portMatch[0].length);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return {error: 'Invalid port'};
  if (!validProxyHost(host)) return {error: 'Invalid server address'};
  if (!SCHEMES.has(scheme)) return {error: 'Invalid protocol'};
  return {scheme, host, port, username, password};
}

export function profileById(settings: Settings, id: string): Profile | null {
  if (id === 'direct') return null;
  return settings.profiles.find(profile => profile.id === id) ?? null;
}

export function explainTab(url: string, settings: Settings): {label: string; reason: string} {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return {label: '', reason: 'No recognizable URL. Open a regular website to inspect routing.'}; }
  const internal = parsed.protocol === 'chrome-extension:' || parsed.protocol === 'chrome:' || parsed.protocol === 'edge:' || parsed.protocol === 'about:' || parsed.protocol === 'devtools:';
  if (internal) return {label: 'Browser internal page', reason: 'This tab is not a website. Open an HTTP or HTTPS page to inspect routing.'};
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return {label: parsed.hostname || parsed.protocol, reason: 'This tab is not an HTTP or HTTPS website. Routing rules do not apply.'};
  return {label: parsed.hostname, reason: resolve(settings, parsed.hostname).reason};
}

export function resolve(settings: Settings, host: string): Decision {
  const shown = normalizeHost(host) || host;
  if (isLocalHost(host)) {
    return {profileId: 'direct', profile: null, reason: `Local address ${shown} always connects directly.`};
  }
  if (!settings.enabled) {
    return {profileId: 'direct', profile: null, reason: 'Proxy management is off; Chrome uses the current system settings.'};
  }
  for (const rule of settings.rules) {
    if (!patternMatches(host, rule.pattern)) continue;
    if (rule.profileId === 'direct') {
      return {profileId: 'direct', profile: null, reason: `Matched rule ${rule.pattern} specifies a direct connection.`};
    }
    const profile = profileById(settings, rule.profileId);
    if (!profile) {
      return {profileId: 'direct', profile: null, reason: `Matched rule ${rule.pattern} points to a deleted profile, so it connects directly.`};
    }
    return {profileId: profile.id, profile, reason: `Matched rule ${rule.pattern} uses profile “${profile.name}”. ${rule.pattern.startsWith('*.') ? '' : 'This domain and its subdomains match.'}`};
  }
  if (settings.defaultProfileId === 'direct') {
    return {profileId: 'direct', profile: null, reason: `No rule matched ${shown}; default is direct.`};
  }
  const profile = profileById(settings, settings.defaultProfileId);
  if (!profile) {
    return {profileId: 'direct', profile: null, reason: `No rule matched ${shown}; the default profile was deleted, so it connects directly.`};
  }
  return {profileId: profile.id, profile, reason: `No rule matched ${shown}; using default profile “${profile.name}”.`};
}

function pacString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pacToken(profile: Profile): string {
  if (profile.scheme === 'socks5') return `SOCKS5 ${profile.host}:${profile.port}`;
  if (profile.scheme === 'socks4') return `SOCKS4 ${profile.host}:${profile.port}`;
  if (profile.scheme === 'https') return `HTTPS ${profile.host}:${profile.port}`;
  return `PROXY ${profile.host}:${profile.port}`;
}

export function buildPac(settings: Settings): string {
  const lines = [
    'function FindProxyForURL(url, host) {',
    "  if (isPlainHostName(host) || host === 'localhost' || isInNet(host, '127.0.0.0', '255.0.0.0')) return 'DIRECT';",
  ];
  if (settings.enabled) {
    for (const rule of settings.rules) {
      if (validatePattern(rule.pattern)) continue;
      const profile = rule.profileId === 'direct' ? null : profileById(settings, rule.profileId);
      const token = rule.profileId === 'direct' ? 'DIRECT' : profile ? pacToken(profile) : 'DIRECT';
      if (rule.pattern === '*') {
        lines.push(`  return ${pacString(token)};`);
        break;
      }
      const base = rule.pattern.startsWith('*.') ? rule.pattern.slice(2) : rule.pattern;
      lines.push(`  if (host === ${pacString(base)} || dnsDomainIs(host, ${pacString('.'+base)})) return ${pacString(token)};`);
    }
    const fallback = settings.defaultProfileId === 'direct' ? null : profileById(settings, settings.defaultProfileId);
    lines.push(`  return ${pacString(fallback ? pacToken(fallback) : 'DIRECT')};`);
  } else {
    lines.push("  return 'DIRECT';");
  }
  lines.push('}');
  return lines.join('\n');
}

export function classifyProxyError(error: string, fatal = true): Diagnosis {
  const code = error.replace(/^net::/, '');
  const raw = `Chrome reported ${code}. `;
  if (/PROXY_AUTH|UNEXPECTED_PROXY_AUTH|ERR_INVALID_AUTH_CREDENTIALS|407/.test(code)) {
    return {kind: 'auth', title: 'Authentication failed', detail: `${raw}The proxy requires authentication or rejected the credentials. Chrome does not support SOCKS authentication.`};
  }
  if (/PROXY_CERTIFICATE|CERT_|SSL_PROTOCOL|ERR_PROXY_HTTP/.test(code)) {
    return {kind: 'protocol', title: 'Protocol mismatch', detail: `${raw}Encryption or proxy protocol differs from the configuration.`};
  }
  if (/SOCKS_CONNECTION_FAILED|SOCKS_CONNECTION_HOST_UNREACHABLE/.test(code)) {
    return {kind: 'protocol', title: 'Protocol mismatch', detail: `${raw}SOCKS handshake failed. Check the protocol version and server port.`};
  }
  if (/TUNNEL_CONNECTION_FAILED/.test(code)) {
    return {kind: 'tunnel', title: 'Tunnel failed', detail: `${raw}The proxy connected but could not create an HTTPS CONNECT tunnel.`};
  }
  if (/PROXY_CONNECTION_FAILED|CONNECTION_REFUSED|ADDRESS_UNREACHABLE|CONNECTION_TIMED_OUT|NAME_NOT_RESOLVED/.test(code)) {
    return {kind: 'port', title: 'Port unreachable', detail: `${raw}The proxy did not accept the connection, or its address could not resolve.`};
  }
  if (!fatal && /CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT|EMPTY_RESPONSE|ABORTED/.test(code)) {
    return {kind: 'target', title: 'Target site error', detail: `${raw}No fatal proxy error was reported. The target or intermediate connection may have closed.`};
  }
  return {kind: 'unknown', title: 'Unknown', detail: `${raw}Not enough information to identify the failing layer.`};
}

export function authWarning(profile: Profile): string | null {
  if ((profile.username || profile.password) && !chromeCanAuthenticate(profile.scheme)) {
    return 'Chrome cannot send SOCKS usernames or passwords. This proxy will connect without authentication.';
  }
  return null;
}
