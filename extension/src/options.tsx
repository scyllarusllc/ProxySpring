import {useEffect, useState} from 'react';
import {authWarning, emptySettings, parseProxyLine, validatePattern, type Profile, type Rule, type Scheme, type Settings} from '../../shared/proxy';
import {loadSettings, saveSettings} from './storage';
import '../../shared/theme.css';

const schemes: Scheme[] = ['http', 'https', 'socks4', 'socks5'];

function newId(): string {
  return crypto.randomUUID();
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(emptySettings());
  const [draft, setDraft] = useState({name: '', scheme: 'http' as Scheme, host: '', port: '8080', username: '', password: ''});
  const [pattern, setPattern] = useState('');
  const [ruleProfile, setRuleProfile] = useState('direct');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { void loadSettings().then(value => { setSettings(value); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) void saveSettings(settings); }, [settings, loaded]);

  function addProfile(profile: Omit<Profile, 'id'>) {
    const next: Profile = {...profile, id: newId()};
    setSettings(current => ({...current, profiles: [...current.profiles, next]}));
    return next;
  }

  function onAdd(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseProxyLine(`${draft.scheme}://${draft.host}:${draft.port}`);
    if ('error' in parsed) { setMessage(parsed.error); return; }
    const profile = {...parsed, name: draft.name.trim() || `${parsed.host}:${parsed.port}`, username: draft.username, password: draft.password};
    addProfile(profile);
    setMessage(authWarning({...profile, id: ''}) || 'Saved.');
    setDraft({name: '', scheme: draft.scheme, host: '', port: draft.port, username: '', password: ''});
  }

  function onImport() {
    const lines = importText.split(/\n+/);
    const added: string[] = [];
    const failed: string[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseProxyLine(line);
      if ('error' in parsed) failed.push(`${line.trim()}（${parsed.error}）`);
      else {
        const profile = addProfile({...parsed, name: `${parsed.scheme} ${parsed.host}:${parsed.port}`});
        const warning = authWarning(profile);
        added.push(warning ? `${profile.name}。${warning}` : profile.name);
      }
    }
    setMessage([added.length ? `Imported ${added.length} entries. ${added.join(' ')}` : '', failed.length ? `Failed to import: ${failed.join('；')}` : ''].filter(Boolean).join(' '));
    setImportText('');
  }

  function addRule(event: React.FormEvent) {
    event.preventDefault();
    const error = validatePattern(pattern);
    if (error) { setMessage(error); return; }
    const rule: Rule = {id: newId(), pattern: pattern.trim().toLowerCase(), profileId: ruleProfile};
    setSettings(current => ({...current, rules: [...current.rules, rule]}));
    setPattern('');
    setMessage('Rule added. Earlier rules take priority.');
  }

  return (
    <div>
      <section className="grid">
        <form className="card" onSubmit={onAdd}>
          <h2>Add proxy</h2>
          <label>Name<input value={draft.name} onChange={event => setDraft({...draft, name: event.target.value})}/></label>
          <label>Protocol<select value={draft.scheme} onChange={event => setDraft({...draft, scheme: event.target.value as Scheme})}>{schemes.map(scheme => <option key={scheme}>{scheme}</option>)}</select></label>
          <label>Server<input value={draft.host} onChange={event => setDraft({...draft, host: event.target.value})} required/></label>
          <label>Port<input value={draft.port} onChange={event => setDraft({...draft, port: event.target.value})} required/></label>
          <label>Username<input value={draft.username} onChange={event => setDraft({...draft, username: event.target.value})} autoComplete="off"/></label>
          <label>Password<input type="password" value={draft.password} onChange={event => setDraft({...draft, password: event.target.value})} autoComplete="new-password"/></label>
          <div className="row"><button className="button primary" type="submit">Save proxy</button></div>
        </form>
        <section className="card">
          <h2>Import proxies</h2>
          <p>One per line, for example http://user:pass@host:8080 or socks5://host:1080.</p>
          <textarea value={importText} onChange={event => setImportText(event.target.value)}/>
          <div className="row"><button className="button secondary" type="button" onClick={onImport}>Import</button></div>
        </section>
      </section>
      {message ? <div className="banner warn">{message}</div> : null}
      <section className="list">
        {settings.profiles.map(profile => (
          <article className="item" key={profile.id}>
            <div><strong>{profile.name}</strong><span className="meta">{profile.scheme}://{profile.host}:{profile.port}{profile.username ? ' · Credentials saved' : ''}</span>{authWarning(profile) ? <span className="meta">{authWarning(profile)}</span> : null}</div>
            <button className="button secondary" onClick={() => setSettings(current => ({...current, profiles: current.profiles.filter(item => item.id !== profile.id), defaultProfileId: current.defaultProfileId === profile.id ? 'direct' : current.defaultProfileId, rules: current.rules.map(rule => rule.profileId === profile.id ? {...rule, profileId: 'direct'} : rule)}))}>Delete</button>
          </article>
        ))}
      </section>
      <form className="card" style={{marginTop: 16}} onSubmit={addRule}>
        <h2>Domain rules</h2>
        <p>example.com includes its subdomains. *.example.com also includes the root domain. Local addresses always connect directly.</p>
        <label>Domain<input value={pattern} onChange={event => setPattern(event.target.value)} placeholder="example.com"/></label>
        <label>Use
          <select value={ruleProfile} onChange={event => setRuleProfile(event.target.value)}>
            <option value="direct">Direct</option>
            {settings.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <div className="row"><button className="button primary">Add rule</button></div>
        <div className="list">
          {settings.rules.map(rule => (
            <article className="item" key={rule.id}>
              <div><strong>{rule.pattern}</strong><span className="meta">{rule.profileId === 'direct' ? 'Direct' : settings.profiles.find(profile => profile.id === rule.profileId)?.name || 'Profile deleted'}</span></div>
              <button className="button secondary" type="button" onClick={() => setSettings(current => ({...current, rules: current.rules.filter(item => item.id !== rule.id)}))}>Delete</button>
            </article>
          ))}
        </div>
      </form>
    </div>
  );
}
