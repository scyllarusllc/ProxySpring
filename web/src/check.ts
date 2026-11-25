// The /check page: runs in the visitor's browser, with the same logic as the extension's Check tab.
import {IP_SOURCE, compareTimezone, compareWebRtc, flagText, hostingText, loadExitReport, type IpReport, type WebRtcNote} from '../../shared/check';
import {STUN_LABEL, collectSrflx} from '../../shared/webrtc';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const runIp = $<HTMLButtonElement>('run-ip'), runRtc = $<HTMLButtonElement>('run-rtc');
const banner = $('banner'), facts = $('facts');
$('stun-label').textContent = STUN_LABEL;

let report: IpReport | null = null;
let webrtc: WebRtcNote = {state: 'not-run', text: 'Not run. STUN connects only when you start the check.', addresses: []};

function setBusy(which: 'ip' | 'rtc' | null) {
  runIp.disabled = which !== null;
  runRtc.disabled = which !== null || report?.status !== 'ok';
  runIp.querySelector('span')!.textContent = which === 'ip' ? 'Checking…' : 'Check connection';
  runRtc.querySelector('span')!.textContent = which === 'rtc' ? 'Checking…' : 'Check WebRTC exit';
}

function row(label: string, value: string | HTMLElement) {
  const box = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
  box.className = 'fact';
  dt.textContent = label;
  if (typeof value === 'string') dd.textContent = value; else dd.append(value);
  box.append(dt, dd);
  return box;
}

function note(text: string, different: boolean) {
  if (!different) return text;
  const span = document.createElement('span');
  span.className = 'banner danger';
  span.textContent = text;
  return span;
}

function render() {
  banner.hidden = true;
  facts.hidden = true;
  if (!report) return;
  if (report.status === 'unavailable') {
    banner.textContent = `Data source unavailable. ${report.message ?? ''} Checked at ${report.checkedAt}.`;
    banner.hidden = false;
    return;
  }
  const zone = compareTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, report.timezone);
  facts.replaceChildren(
    row('Exit IP', `${report.ip} · ${report.version || 'Version unknown'} · ${report.source} · ${report.checkedAt}${report.message ? `. ${report.message}` : ''}`),
    row('Country', `${report.flag ? `${report.flag} ` : ''}${report.country || 'Country unavailable'}`),
    row('State / Region', report.region || 'Region unavailable'),
    row('City', report.city || 'City unavailable'),
    row('Network', `${[report.isp, report.asn].filter(Boolean).join(' · ') || 'Network unavailable'}. Location is a database estimate.`),
    row('IP type', hostingText(report.hosting, report.source)),
    row('VPN flag', flagText('VPN', report.vpn, report.source)),
    row('Proxy flag', flagText('Proxy', report.proxy, report.source)),
    row('Tor flag', flagText('Tor', report.tor, report.source)),
    row('Time zone', note(zone.text, zone.state === 'different')),
    row('WebRTC', note(webrtc.text, webrtc.state === 'different')),
  );
  facts.hidden = false;
}

runIp.addEventListener('click', async () => {
  setBusy('ip');
  try {
    report = await loadExitReport();
  } catch {
    report = {status: 'unavailable', source: IP_SOURCE, checkedAt: new Date().toISOString(), message: 'The data source was unreachable. This is different from an unmarked result.'};
  }
  setBusy(null);
  render();
});

runRtc.addEventListener('click', async () => {
  setBusy('rtc');
  try {
    webrtc = compareWebRtc(report?.ip, await collectSrflx());
  } catch {
    webrtc = {state: 'unavailable', text: 'The browser blocked or interrupted the WebRTC check.', addresses: []};
  }
  setBusy(null);
  render();
});
