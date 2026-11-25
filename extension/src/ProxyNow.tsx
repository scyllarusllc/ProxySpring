import {useEffect, useRef, useState} from 'react';
import {loadExitReport, type IpReport} from '../../shared/check';
import {authWarning, buildPac, type Settings} from '../../shared/proxy';
import {readProxyControl} from './control';

const COUNTDOWN = 10;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Stage = {kind: 'ask'; left: number} | {kind: 'working'} | {kind: 'done'; report: IpReport} | {kind: 'cancelled'};

/** After a proxy is imported or added: counts down, then turns the proxy on and shows the new exit. */
export function ProxyNow({settings, name, count = 1, onChange, onProxied}: {
  settings: Settings;
  name: string;
  count?: number;
  onChange: (next: Settings) => void;
  onProxied?: (report: IpReport) => void;
}) {
  const [stage, setStage] = useState<Stage>({kind: 'ask', left: COUNTDOWN});
  const latest = useRef(settings);
  latest.current = settings;
  const started = useRef(false);

  async function run() {
    if (started.current) return;
    started.current = true;
    setStage({kind: 'working'});
    const next: Settings = {...latest.current, enabled: true};
    if (!latest.current.enabled) onChange(next);
    // Wait until Chrome reports the new PAC script is live before asking where we exit.
    const pac = buildPac(next);
    for (let i = 0; i < 20; i++) {
      if (await readProxyControl(true, pac) === 'active') break;
      await sleep(250);
    }
    await sleep(400);
    let report: IpReport;
    try { report = await loadExitReport(); }
    catch { report = {status: 'unavailable', source: 'getip.cloud', checkedAt: new Date().toISOString(), message: 'The data source was unreachable.'}; }
    setStage({kind: 'done', report});
    onProxied?.(report);
  }

  useEffect(() => {
    if (settings.enabled) { void run(); return; }
    const timer = setInterval(() => {
      setStage(current => current.kind === 'ask' ? {kind: 'ask', left: current.left - 1} : current);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage.kind === 'ask' && stage.left <= 0) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const profile = settings.profiles.find(item => item.name === name);
  const warning = profile ? authWarning(profile) : null;

  if (stage.kind === 'cancelled') return <div className="note" style={{marginTop: 12}} role="status">Not proxying. Use Start proxy whenever you are ready.</div>;
  if (stage.kind === 'ask') {
    return (
      <div className="success-box" role="status">
        <div className="countdown" style={{['--n' as string]: stage.left}} aria-hidden="true">
          <svg viewBox="0 0 52 52"><circle className="track" cx="26" cy="26" r="22"/><circle className="ring" cx="26" cy="26" r="22"/></svg>
          <span>{stage.left}</span>
        </div>
        <div>
          <strong>{count > 1 ? `${count} proxies saved` : 'Proxy saved'}</strong>
          <p>“{name}” is the default. Proxying in {stage.left}s…</p>
          {warning ? <p className="meta">{warning}</p> : null}
          <div className="row" style={{marginTop: 10}}>
            <button className="button primary" type="button" onClick={() => void run()}>Proxy now</button>
            <button className="button secondary" type="button" onClick={() => setStage({kind: 'cancelled'})}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }
  if (stage.kind === 'working') return <div className="success-box working" role="status"><span className="spinner" aria-hidden="true"/><div><strong>Connecting…</strong><p>Applying the proxy and checking your new exit.</p></div></div>;
  const report = stage.report;
  return (
    <div className={`success-box ${report.status === 'ok' ? 'live' : 'warn'}`} role="status">
      {report.status === 'ok'
        ? <><span className="exit-flag bounce" aria-hidden="true">{report.flag || '✓'}</span><div><strong>Proxied · {report.ip}</strong><p>{[report.city, report.region, report.country].filter(Boolean).join(', ') || 'Location unavailable'} via “{name}”.</p></div></>
        : <div><strong>Proxy is on, but the exit check failed</strong><p>{report.message || 'The data source was unavailable.'} Try the Check tab.</p></div>}
    </div>
  );
}
