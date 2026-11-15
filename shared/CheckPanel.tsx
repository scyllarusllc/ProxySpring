import {useState} from 'react';
import {IP_SOURCE, compareTimezone, compareWebRtc, flagText, hostingText, loadExitReport, type IpReport, type WebRtcNote} from './check';
import {STUN_LABEL, collectSrflx} from './webrtc';

export function CheckPanel({proxyHosts = []}: {proxyHosts?: string[]}) {
  const [report, setReport] = useState<IpReport | null>(null);
  const [webrtc, setWebrtc] = useState<WebRtcNote>({state: 'not-run', text: 'Not run. STUN connects only when you start the check.', addresses: []});
  const [busy, setBusy] = useState<'ip' | 'rtc' | null>(null);
  const [error, setError] = useState('');

  async function runIp() {
    setBusy('ip');
    setError('');
    try {
      setReport(await loadExitReport());
    } catch {
      setReport({status: 'unavailable', source: IP_SOURCE, checkedAt: new Date().toISOString(), message: 'The data source was unreachable. This is different from an unmarked result.'});
    } finally {
      setBusy(null);
    }
  }

  async function runRtc() {
    setBusy('rtc');
    try {
      const addresses = await collectSrflx();
      setWebrtc(compareWebRtc(report?.ip, addresses));
    } catch {
      setWebrtc({state: 'unavailable', text: 'The browser blocked or interrupted the WebRTC check.', addresses: []});
    } finally {
      setBusy(null);
    }
  }

  const zone = report?.status === 'ok' ? compareTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, report.timezone) : null;

  return (
    <div className="stack">
      <div className="row">
        <button className="button primary" onClick={runIp} disabled={busy !== null}>{busy === 'ip' ? 'Checking…' : 'Check connection'}</button>
        <button className="button secondary" onClick={runRtc} disabled={busy !== null || report?.status !== 'ok'}>Check WebRTC exit</button>
      </div>
      <p className="note">The check contacts <a href="https://getip.cloud/json" target="_blank" rel="noreferrer">{IP_SOURCE}</a>, which sees the request's source IP. Proxy credentials are not sent. This source does not provide VPN, proxy, or Tor flags. WebRTC uses {STUN_LABEL} without camera or microphone access.</p>
      {error ? <div className="banner">{error}</div> : null}
      {report?.status === 'unavailable' ? <div className="banner">Data source unavailable. {report.message} Checked at {report.checkedAt}.</div> : null}
      {report?.status === 'ok' ? (
        <dl className="facts">
          <div><dt>Exit IP</dt><dd>{report.ip} · {report.version || 'Version unknown'} · {report.source} · {report.checkedAt}{report.message ? `. ${report.message}` : ''}{proxyHosts.includes(report.ip || '') ? ' This address matches a saved proxy server. It does not prove other sites use the same exit.' : ''}</dd></div>
          <div><dt>Country</dt><dd>{report.flag ? `${report.flag} ` : ''}{report.country || 'Country unavailable'}</dd></div>
          <div><dt>State / Region</dt><dd>{report.region || 'Region unavailable'}</dd></div>
          <div><dt>City</dt><dd>{report.city || 'City unavailable'}</dd></div>
          <div><dt>Network</dt><dd>{[report.isp, report.asn].filter(Boolean).join(' · ') || 'Network unavailable'}. Location is a database estimate.</dd></div>
          <div><dt>IP type</dt><dd>{hostingText(report.hosting, report.source)}</dd></div>
          <div><dt>VPN flag</dt><dd>{flagText('VPN', report.vpn, report.source)}</dd></div>
          <div><dt>Proxy flag</dt><dd>{flagText('Proxy', report.proxy, report.source)}</dd></div>
          <div><dt>Tor flag</dt><dd>{flagText('Tor', report.tor, report.source)}</dd></div>
          <div><dt>Time zone</dt><dd>{zone?.state === 'different' ? <span className="banner danger">{zone.text}</span> : zone?.text}</dd></div>
          <div><dt>WebRTC</dt><dd>{webrtc.state === 'different' ? <span className="banner danger">{webrtc.text}</span> : webrtc.text}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
