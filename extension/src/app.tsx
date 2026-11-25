import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {compareTimezone, loadExitReport, type IpReport} from '../../shared/check';
import {buildPac, explainTab, profileById, resolve, type Settings} from '../../shared/proxy';
import {CheckPanel} from '../../shared/CheckPanel';
import {loadErrors, loadSettings, saveSettings, type ErrorEvent} from './storage';
import {SettingsPanel} from './options';
import {ImportProxies} from './ImportProxies';
import {controlMessage, readProxyControl, type ProxyControl} from './control';
import '../../shared/theme.css';

type TabId = 'connection' | 'settings' | 'check';

const tabs: {id: TabId; label: string}[] = [
  {id: 'connection', label: 'Connection'},
  {id: 'settings', label: 'Profiles'},
  {id: 'check', label: 'Check'},
];

function tabFromHash(): TabId {
  const hash = location.hash.replace('#', '');
  return tabs.some(tab => tab.id === hash) ? hash as TabId : 'connection';
}

async function siteUrl(): Promise<string> {
  const own = chrome.runtime.getURL('');
  const open = await chrome.tabs.query({currentWindow: true});
  const active = open.find(tab => tab.active && tab.url && !tab.url.startsWith(own));
  if (active?.url) return active.url;
  const web = [...open].reverse().find(tab => tab.url && /^https?:/.test(tab.url));
  return web?.url || '';
}

function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [exit, setExit] = useState<IpReport | null>(null);
  const [control, setControl] = useState<ProxyControl>('unknown');
  const [fresh, setFresh] = useState<string[]>([]);
  const [proxied, setProxied] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadErrors().then(setErrors);
    void siteUrl().then(setPageUrl);
    void loadExitReport().then(setExit);
    const onStore = () => { void loadErrors().then(setErrors); void loadSettings().then(setSettings); };
    const onProxy = () => { void loadSettings().then(value => readProxyControl(value.enabled,buildPac(value))).then(setControl).catch(()=>setControl('unknown')); };
    chrome.proxy.settings.onChange.addListener(onProxy);
    chrome.storage.onChanged.addListener(onStore);
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      chrome.storage.onChanged.removeListener(onStore);
      chrome.proxy.settings.onChange.removeListener(onProxy);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => { if (settings) void readProxyControl(settings.enabled,buildPac(settings)).then(setControl).catch(()=>setControl('unknown')); }, [settings]);

  function open(next: TabId) {
    location.hash = next;
    setTab(next);
  }

  if (!settings) return <main className="wrap"><p className="note">Loading profiles…</p></main>;
  const page = explainTab(pageUrl, settings);
  const active = settings.enabled ? profileById(settings, settings.defaultProfileId) : null;
  const statusText = !settings.enabled ? 'ProxySpring off' : control === 'active' ? active ? `Using “${active.name}”` : 'Direct' : 'Saved choice is not confirmed active';
  const checkRoute = resolve({...settings,enabled:true},'getip.cloud');
  const zone = exit?.status === 'ok' ? compareTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, exit.timezone) : null;

  function patch(next: Settings) {
    setSettings(next);
    void saveSettings(next);
  }

  function toggleProxy() {
    if (!settings) return;
    patch({...settings, enabled: !settings.enabled});
    setTimeout(() => void loadExitReport().then(setExit), 1500);
  }

  function onImported(next: Settings, ids?: string[]) {
    patch(next);
    if (ids) { setFresh(ids); setTimeout(() => setFresh([]), 2800); }
  }

  function onProxied(report: IpReport) {
    setExit(report);
    setProxied(true);
    setTimeout(() => setProxied(false), 4000);
  }

  return (
    <main className="wrap">
      <p className="eyebrow">EXTENSION</p>
      <h1 className="display">ProxySpring</h1>
      <div className="tabbar" role="tablist" aria-label="ProxySpring sections" onKeyDown={event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const index=tabs.findIndex(item=>item.id===tab); const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length; open(tabs[next].id); (event.currentTarget.querySelectorAll('[role=tab]')[next] as HTMLButtonElement).focus(); }}>
        {tabs.map(item => (
          <button key={item.id} id={`tab-${item.id}`} role="tab" aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => open(item.id)}>{item.label}</button>
        ))}
      </div>
      {tab === 'connection' ? (
        <section id="panel-connection" role="tabpanel" aria-labelledby="tab-connection">
          <div className={`exit-status card hero-status${settings.enabled ? ' on' : ''}${proxied ? ' proxied' : ''}`}>
            <span className={`exit-flag${proxied ? ' bounce' : ''}`} aria-hidden="true">{exit?.status === 'ok' && exit.flag ? exit.flag : '—'}</span>
            <div className="status-main">
              <p className="eyebrow">STATUS</p>
              <strong>{statusText}{exit?.status === 'ok' ? ` · ${exit.ip}` : ''}</strong>
              <p className="note">{exit?.status === 'ok' ? [exit.city, exit.region, exit.country].filter(Boolean).join(', ') || 'Location unavailable' : exit ? `Exit status unknown. ${exit.message || ''}` : 'Checking exit…'}</p>
              {zone?.state === 'different' ? <span className="banner danger">{zone.text}</span> : null}
              <p className="note" role="status">{controlMessage(control)}</p>
            </div>
            <div className="status-action">
              <button className={`button start-proxy${settings.enabled ? ' running' : ''}`} disabled={!settings.enabled && settings.profiles.length === 0} onClick={toggleProxy}>
                <span className="dot" aria-hidden="true"/>{settings.enabled ? 'Stop proxy' : 'Start proxy'}
              </button>
              {!settings.profiles.length ? <button className="button secondary" onClick={() => patch({...settings, enabled: true})}>Manage direct only</button> : null}
              <a className="meta" href="https://getip.cloud/" target="_blank" rel="noreferrer">getip.cloud</a>
            </div>
          </div>
          {settings.profiles.length === 0 ? <div className="banner warn">Start here: paste your proxies into Import below. The first becomes the default and you can proxy right away.</div> : null}
          <div className="grid two-col">
            <ImportProxies settings={settings} onChange={onImported} onProxied={onProxied}/>
            <div className="stack-col">
              <section className="card">
                <p className="eyebrow">DEFAULT PROFILE</p>
                <div className="list">
                  <label className="item"><span><input type="radio" name="profile" checked={settings.defaultProfileId === 'direct'} onChange={() => patch({...settings, defaultProfileId: 'direct'})}/> Direct</span></label>
                  {settings.profiles.map(profile => (
                    <label className={`item${fresh.includes(profile.id) ? ' fresh' : ''}`} key={profile.id}>
                      <span><input type="radio" name="profile" checked={settings.defaultProfileId === profile.id} onChange={() => patch({...settings, defaultProfileId: profile.id})}/> {profile.name}</span>
                      <span className="meta">{profile.scheme} {profile.host}:{profile.port}</span>
                    </label>
                  ))}
                </div>
                {settings.profiles.length === 0 ? <p className="note">No proxies yet. <a href="#settings">Open Profiles</a></p> : null}
              </section>
              <section className="card">
                <p className="eyebrow">CURRENT SITE</p>
                <p style={{marginTop: 8}}>{page.label || 'No regular website in this window'}</p>
                <p className="note">{page.reason}</p>
              </section>
            </div>
          </div>
          <div className="grid two-col">
            <section className="card">
              <p className="eyebrow">WEBRTC</p>
              <label style={{marginTop: 8}}>
                <input type="checkbox" checked={settings.blockWebRtcLeak} onChange={event => patch({...settings, blockWebRtcLeak: event.target.checked})}/> Block non-proxied WebRTC UDP while proxy is on
              </label>
              <p className="note">Chrome then prevents WebRTC UDP from bypassing the proxy. WebRTC may use TCP or fail to connect. Stopping the proxy restores Chrome’s default policy. This does not change your time zone.</p>
            </section>
            <section className="card">
              <p className="eyebrow">RECENT PROXY ERRORS</p>
              {errors.length === 0 ? <p className="note" style={{marginTop: 8}}>No errors recorded. This does not prove the proxy works.</p> : errors.slice(0, 5).map(error => (
                <p className="note" key={error.at}>{error.title} · {error.detail}</p>
              ))}
            </section>
          </div>
          <p className="note" style={{marginTop: 16}}>Proxy access needs broad site permissions so Chrome can route websites and answer proxy authentication challenges. ProxySpring does not read page content. <a href="https://proxyspring.com/privacy" target="_blank" rel="noreferrer">Privacy details</a></p>
        </section>
      ) : null}
      {tab === 'settings' ? <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings"><SettingsPanel/></section> : null}
      {tab === 'check' ? <section id="panel-check" role="tabpanel" aria-labelledby="tab-check"><p className="note">This check requests getip.cloud. {checkRoute.reason} It tests that route, not every saved proxy or website. Confirm Chrome control status on Connection.</p><CheckPanel proxyHosts={settings.profiles.map(profile => profile.host)}/></section> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App/>);
