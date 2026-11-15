import {useEffect, useState} from 'react';
import {authWarning, emptySettings, parseProxyLine, resolve, validatePattern, type Profile, type Rule, type Scheme, type Settings} from '../../shared/proxy';
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
  const [preview, setPreview] = useState<{profiles: Omit<Profile,'id'>[]; errors: string[]} | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [previewHost, setPreviewHost] = useState('');

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
    const profiles: Omit<Profile,'id'>[] = [], errors: string[] = [];
    for (const [index,line] of importText.split(/\n/).entries()) {
      if (!line.trim()) continue;
      let parsed: ReturnType<typeof parseProxyLine>;
      try { parsed = parseProxyLine(line); } catch { errors.push(`Line ${index+1}: malformed encoding`); continue; }
      if ('error' in parsed) errors.push(`Line ${index+1}: ${parsed.error}`);
      else profiles.push({...parsed, name: `${parsed.scheme} ${parsed.host}:${parsed.port}`});
    }
    setPreview({profiles,errors});
    setMessage('Review the import before saving. Credentials are hidden in this preview.');
  }

  function confirmImport() {
    if (!preview?.profiles.length) return;
    setSettings(current => ({...current, profiles: [...current.profiles,...preview.profiles.map(profile=>({...profile,id:newId()}))]}));
    setMessage(`Imported ${preview.profiles.length} profiles.`);
    setPreview(null);setImportText('');
  }

  function moveRule(id: string, direction: -1 | 1) {
    setSettings(current => {
      const rules=[...current.rules],index=rules.findIndex(rule=>rule.id===id),next=index+direction;
      if(index<0||next<0||next>=rules.length)return current;
      [rules[index],rules[next]]=[rules[next],rules[index]];
      return {...current,rules};
    });
  }

  function deleteProfile(profile: Profile) {
    const affected=settings.rules.filter(rule=>rule.profileId===profile.id).length;
    if (!window.confirm(`Delete “${profile.name}”? ${affected} matching rule${affected===1?'':'s'} will become Direct.${settings.defaultProfileId===profile.id?' The default will also become Direct.':''} This cannot be undone.`)) return;
    setSettings(current => ({...current, profiles: current.profiles.filter(item => item.id !== profile.id), defaultProfileId: current.defaultProfileId === profile.id ? 'direct' : current.defaultProfileId, rules: current.rules.map(rule => rule.profileId === profile.id ? {...rule, profileId: 'direct'} : rule)}));
  }

  function useAndCheck(profile: Profile) {
    setSettings(current=>({...current,defaultProfileId:profile.id}));
    setTestMessage(settings.enabled ? `Selected “${profile.name}”. Open Check to test the current route; domain rules may override this default.` : `Selected “${profile.name}”. Start managing on Connection, then open Check.`);
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
      <div className="card"><h2>Quick start</h2><p>1. Save a proxy. 2. Select it as default. 3. Start managing on Connection. 4. Run Check. Chrome may use another controller; confirm the status there.</p><p style={{marginTop:8}}>Chrome requests broad website access to route pages and answer HTTP proxy authentication challenges. ProxySpring does not read page content. <a href="https://proxyspring.com/privacy" target="_blank" rel="noreferrer">See what is stored locally</a>.</p></div>
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
          <label>Proxy lines<textarea value={importText} onChange={event => {setImportText(event.target.value);setPreview(null);}}/></label>
          <div className="row"><button className="button secondary" type="button" onClick={onImport}>Preview import</button></div>
          {preview ? <div role="status"><p>{preview.profiles.length} valid, {preview.errors.length} invalid. Passwords are hidden.</p><ul>{preview.profiles.map((profile,index)=><li key={index}>{profile.name}{authWarning({...profile,id:''})?' · SOCKS credentials cannot be sent by Chrome':''}</li>)}</ul><ul>{preview.errors.map((error,index)=><li key={index}>{error}</li>)}</ul><button className="button primary" type="button" disabled={!preview.profiles.length} onClick={confirmImport}>Save valid profiles</button></div> : null}
        </section>
      </section>
      {message ? <div className="banner warn" role="status">{message}</div> : null}
      {testMessage ? <div className="banner warn" role="status">{testMessage} <a href="#check">Open Check</a></div> : null}
      <section className="list">
        {settings.profiles.map(profile => (
          <article className="item" key={profile.id}>
            <div><strong>{profile.name}</strong><span className="meta">{profile.scheme}://{profile.host}:{profile.port}{profile.username ? ' · Credentials saved' : ''}</span>{authWarning(profile) ? <span className="meta">{authWarning(profile)}</span> : null}</div>
            <div className="row"><button className="button secondary" onClick={() => useAndCheck(profile)}>Set default → Check</button><button className="button secondary" onClick={() => deleteProfile(profile)}>Delete</button></div>
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
        <label>Preview a website hostname<input value={previewHost} onChange={event=>setPreviewHost(event.target.value)} placeholder="www.example.com"/></label>
        {previewHost.trim() ? <p className="note" role="status">{resolve({...settings,enabled:true},previewHost.trim().replace(/^https?:\/\//,'').split('/')[0]).reason}</p> : null}
        <div className="list">
          {settings.rules.map((rule,index) => (
            <article className="item" key={rule.id}>
              <div><strong>{rule.pattern}</strong><span className="meta">{rule.profileId === 'direct' ? 'Direct' : settings.profiles.find(profile => profile.id === rule.profileId)?.name || 'Profile deleted'}</span></div>
              <div className="row"><button className="button secondary" type="button" disabled={index===0} onClick={() => moveRule(rule.id,-1)} aria-label={`Move ${rule.pattern} earlier`}>↑</button><button className="button secondary" type="button" disabled={index===settings.rules.length-1} onClick={() => moveRule(rule.id,1)} aria-label={`Move ${rule.pattern} later`}>↓</button><button className="button secondary" type="button" onClick={() => setSettings(current => ({...current, rules: current.rules.filter(item => item.id !== rule.id)}))}>Delete</button></div>
            </article>
          ))}
        </div>
      </form>
    </div>
  );
}
