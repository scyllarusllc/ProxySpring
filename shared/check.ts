export const IP_SOURCE = 'getip.cloud';

export type FlagState = 'marked' | 'unmarked' | 'absent';

export type IpReport = {
  status: 'ok' | 'unavailable';
  source: string;
  checkedAt: string;
  message?: string;
  ip?: string;
  version?: string;
  country?: string;
  countryCode?: string;
  flag?: string;
  region?: string;
  city?: string;
  isp?: string;
  asn?: string;
  hosting?: FlagState;
  vpn?: FlagState;
  proxy?: FlagState;
  tor?: FlagState;
  timezone?: string;
};

export type ZoneNote = {
  state: 'same' | 'different' | 'unknown';
  text: string;
};

export type WebRtcNote = {
  state: 'not-run' | 'unavailable' | 'none' | 'same' | 'different';
  text: string;
  addresses: string[];
};

export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '';
  return [...code.toUpperCase()].map(char => String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65)).join('');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function normalizeGetip(payload: unknown, checkedAt: string): IpReport {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  if (!data || typeof data.ip !== 'string' || !data.ip) {
    return {status: 'unavailable', source: IP_SOURCE, checkedAt, message: 'The data source did not return a usable IP.'};
  }
  const countryCode = text(data.countryCode);
  const asn = data.asn;
  return {
    status: 'ok',
    source: IP_SOURCE,
    checkedAt,
    ip: data.ip,
    version: text(data.version) || (data.ip.includes(':') ? 'IPv6' : 'IPv4'),
    country: text(data.country),
    countryCode,
    flag: text(data.countryFlag) || (countryCode ? flagEmoji(countryCode) : undefined),
    region: text(data.region),
    city: text(data.city),
    isp: text(data.organization),
    asn: typeof asn === 'number' || typeof asn === 'string' ? `AS${asn}` : undefined,
    hosting: 'absent',
    vpn: 'absent',
    proxy: 'absent',
    tor: 'absent',
    timezone: text(data.timezone),
  };
}

export function httpFailureMessage(status: number): string {
  if (status === 429) return 'HTTP 429: too many requests. This is not an unmarked result.';
  return `HTTP ${status}.`;
}

type FetchLike = (input: string, init?: {cache?: RequestCache}) => Promise<{ok: boolean; status: number; json: () => Promise<unknown>}>;

async function readJson(fetchImpl: FetchLike, url: string): Promise<{ok: true; payload: unknown} | {ok: false; message: string}> {
  try {
    const response = await fetchImpl(url, {cache: 'no-store'});
    if (!response.ok) return {ok: false, message: httpFailureMessage(response.status)};
    return {ok: true, payload: await response.json()};
  } catch {
    return {ok: false, message: 'The browser could not connect.'};
  }
}

export async function loadExitReport(fetchImpl: FetchLike = fetch): Promise<IpReport> {
  const checkedAt = new Date().toISOString();
  const primary = await readJson(fetchImpl, 'https://getip.cloud/json');
  if (!primary.ok) return {status: 'unavailable', source: IP_SOURCE, checkedAt, message: primary.message};
  return normalizeGetip(primary.payload, checkedAt);
}

export function flagText(label: string, state: FlagState | undefined, source: string): string {
  if (state === 'marked') return `${source} marks this IP as ${label}.`;
  if (state === 'unmarked') return `${source} does not mark this IP as ${label}.`;
  return `${source} does not provide a ${label} flag.`;
}

export function hostingText(state: FlagState | undefined, source: string): string {
  if (state === 'marked') return `${source} reports this IP as a data center or hosting network.`;
  if (state === 'unmarked') return `${source} does not report this IP as a data center; residential and mobile types are unavailable.`;
  return `${source} does not provide an IP type.`;
}

export function compareTimezone(browserZone: string, ipZone: string | undefined): ZoneNote {
  if (!ipZone) return {state: 'unknown', text: 'The data source did not provide a time zone.'};
  if (browserZone === ipZone) return {state: 'same', text: `Browser time zone ${browserZone} matches the exit estimate ${ipZone}. This does not prove a direct connection.`};
  return {state: 'different', text: `Browser time zone ${browserZone} differs from the exit estimate ${ipZone}. Travel, remote desktops, and database errors can also cause this.`};
}

export function compareWebRtc(exitIp: string | undefined, addresses: string[]): WebRtcNote {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (!exitIp) return {state: 'unavailable', text: 'No exit IP to compare with WebRTC.', addresses: unique};
  if (unique.length === 0) return {state: 'none', text: 'No public WebRTC address was observed. This does not prove there is no leak.', addresses: []};
  const different = unique.filter(address => address !== exitIp);
  if (different.length === 0) return {state: 'same', text: 'Observed WebRTC addresses match this request’s exit IP.', addresses: unique};
  return {state: 'different', text: `WebRTC observed ${different.join(', ')}, different from request exit ${exitIp}. This only shows the paths differ.`, addresses: unique};
}
