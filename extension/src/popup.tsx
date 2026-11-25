import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {explainTab, type Settings} from '../../shared/proxy';
import {CheckPanel} from '../../shared/CheckPanel';
import {loadErrors, loadSettings, saveSettings, type ErrorEvent} from './storage';
import '../../shared/theme.css';

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [errors, setErrors] = useState<ErrorEvent[]>([]);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadErrors().then(setErrors);
    void chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
      setPageUrl(tabs[0]?.url || '');
    });
    const listener = () => { void loadErrors().then(setErrors); void loadSettings().then(setSettings); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!settings) return <main className="popup"><p className="note">Loading profiles…</p></main>;
  const page = explainTab(pageUrl, settings);

  function patch(next: Settings) {
    setSettings(next);
    void saveSettings(next);
  }

  return (
    <main className="popup">
      <div className="split">
        <h1>ProxySpring</h1>
        <button className="button secondary" onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>
      <p className="note" style={{margin: '8px 0 12px'}}>{settings.enabled ? 'Extension is managing the proxy.' : 'Proxy management is off. System settings apply.'}</p>
      <button className={`button start-proxy${settings.enabled ? ' running' : ''}`} style={{width: '100%'}} onClick={() => patch({...settings, enabled: !settings.enabled})}><span className="dot" aria-hidden="true"/>{settings.enabled ? 'Stop proxy' : 'Start proxy'}</button>
      <section style={{marginTop: 14}}>
        <p className="eyebrow">Current site</p>
        <p style={{marginTop: 8}}>{page.label || 'No recognizable URL in this tab'}</p>
        <p className="note">{page.reason}</p>
      </section>
      <section style={{marginTop: 14}}>
        <p className="eyebrow">Default profile</p>
        <div className="list">
          <label className="item"><span><input type="radio" name="profile" checked={settings.defaultProfileId === 'direct'} onChange={() => patch({...settings, defaultProfileId: 'direct'})}/> Direct</span></label>
          {settings.profiles.map(profile => (
            <label className="item" key={profile.id}>
              <span><input type="radio" name="profile" checked={settings.defaultProfileId === profile.id} onChange={() => patch({...settings, defaultProfileId: profile.id})}/> {profile.name}</span>
              <span className="meta">{profile.scheme} {profile.host}:{profile.port}</span>
            </label>
          ))}
        </div>
      </section>
      <section style={{marginTop: 14}}>
        <p className="eyebrow">Recent proxy errors</p>
        {errors.length === 0 ? <p className="note">No errors recorded. This does not prove the proxy works.</p> : errors.slice(0, 3).map(error => (
          <p className="note" key={error.at}>{error.title} · {error.detail}</p>
        ))}
      </section>
      <section style={{marginTop: 14}}>
        <p className="eyebrow">Current connection</p>
        <CheckPanel proxyHosts={settings.profiles.map(profile => profile.host)}/>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup/>);
