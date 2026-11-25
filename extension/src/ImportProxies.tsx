import {useRef, useState} from 'react';
import type {IpReport} from '../../shared/check';
import {parseProxyLine, type Profile, type Settings} from '../../shared/proxy';
import {ProxyNow} from './ProxyNow';

const EXAMPLES = [
  '203.0.113.10:12323:user:pass',
  '203.0.113.10:12323@user:pass',
  'user:pass:203.0.113.10:12323',
  'user:pass@203.0.113.10:12323',
];

function newId(): string {
  return crypto.randomUUID();
}

function parseAll(text: string) {
  const profiles: Omit<Profile, 'id'>[] = [];
  const errors: string[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const parsed = parseProxyLine(line);
    if ('error' in parsed) errors.push(`Line ${index + 1}: ${parsed.error}`);
    else profiles.push({...parsed, name: `${parsed.scheme} ${parsed.host}:${parsed.port}`});
  }
  return {profiles, errors};
}

export function ImportProxies({settings, onChange, onProxied, hero = false}: {
  settings: Settings;
  onChange: (next: Settings, addedIds?: string[]) => void;
  onProxied?: (report: IpReport) => void;
  hero?: boolean;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<{id: number; name: string; count: number} | null>(null);
  const [flashing, setFlashing] = useState(false);
  const latest = useRef(settings);
  latest.current = settings;

  function runImport() {
    const {profiles, errors: bad} = parseAll(text);
    setErrors(bad);
    if (!profiles.length) { setPending(null); return; }
    const added = profiles.map(profile => ({...profile, id: newId()}));
    const next: Settings = {...latest.current, profiles: [...latest.current.profiles, ...added], defaultProfileId: added[0].id};
    onChange(next, added.map(profile => profile.id));
    setText('');
    setFlashing(true);
    setTimeout(() => setFlashing(false), 1000);
    setPending({id: Date.now(), name: added[0].name, count: added.length});
  }

  return (
    <section className={`card import-card${hero ? ' hero' : ''}`} data-flash={flashing ? 'on' : 'off'}>
      <h2>Import proxies</h2>
      <p>One per line. Protocol is optional and defaults to http; also accepts https://, socks4://, socks5://.</p>
      <label>Proxy lines
        <textarea value={text} placeholder={EXAMPLES.join('\n')} spellCheck={false} onChange={event => { setText(event.target.value); setErrors([]); }}/>
      </label>
      <div className="row"><button className="button primary" type="button" disabled={!text.trim()} onClick={runImport}>Import</button></div>
      {errors.length ? <div className="banner warn" role="status"><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div> : null}
      {pending ? <ProxyNow key={pending.id} settings={settings} name={pending.name} count={pending.count} onChange={next => onChange(next)} onProxied={onProxied}/> : null}
    </section>
  );
}
