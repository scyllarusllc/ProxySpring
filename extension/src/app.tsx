import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {compareTimezone, loadExitReport, type IpReport} from '../../shared/check';
import {buildPac, explainTab, profileById, resolve, type Settings} from '../../shared/proxy';
import {CheckPanel} from '../../shared/CheckPanel';
import {loadErrors, loadSettings, saveSettings, type ErrorEvent} from './storage';
import {SettingsPanel} from './options';
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
          <p className="eyebrow">Status</p>
          <div className="exit-status card">
            <span className="exit-flag" aria-hidden="true">{exit?.status === 'ok' && exit.flag ? exit.flag : '—'}</span>
            <div>
              <strong>{statusText}{exit?.status === 'ok' ? ` · ${exit.ip}` : ''}</strong>
              <p className="note">{exit?.status === 'ok' ? [exit.city, exit.region, exit.country].filter(Boolean).join(', ') || 'Location unavailable' : exit ? `Exit status unknown. ${exit.message || ''}` : 'Checking exit…'}</p>
              {zone?.state === 'different' ? <span className="banner danger">{zone.text}</span> : null}
              <p className="note"><a href="https://getip.cloud/" target="_blank" rel="noreferrer">getip.cloud</a></p>
            </div>
          </div>
          <p className="note" style={{marginTop: 10}} role="status">{controlMessage(control)}</p>
          {settings.profiles.length===0 ? <div className="banner warn">Start here: 1. Add a proxy in Profiles. 2. Select it as default. 3. Start managing. 4. Check the connection.</div> : null}
          <div className="row"><button className="button primary" disabled={!settings.enabled && settings.profiles.length===0} onClick={() => patch({...settings, enabled: !settings.enabled})}>{settings.enabled ? 'Stop managing' : 'Start managing'}</button>{!settings.profiles.length ? <><button className="button secondary" onClick={()=>open('settings')}>Add your first proxy</button><button className="button secondary" onClick={()=>patch({...settings,enabled:true})}>Manage direct only</button></> : null}</div>
          <label style={{marginTop: 16}}>
            <input type="checkbox" checked={settings.blockWebRtcLeak} onChange={event => patch({...settings, blockWebRtcLeak: event.target.checked})}/> Block non-proxied WebRTC UDP while managing proxy
          </label>
          <p className="note">When enabled, Chrome prevents WebRTC UDP from bypassing the proxy. WebRTC may use TCP or fail to connect. Turning off proxy management restores Chrome’s default policy. This does not change your time zone.</p>
          <p className="note" style={{marginTop:12}}>Proxy access needs broad site permissions so Chrome can route websites and answer proxy authentication challenges. ProxySpring does not read page content. <a href="https://proxyspring.com/privacy" target="_blank" rel="noreferrer">Privacy details</a></p>
          <section style={{marginTop: 18}}>
            <p className="eyebrow">Current site</p>
            <p style={{marginTop: 8}}>{page.label || 'No regular website in this window'}</p>
            <p className="note">{page.reason}</p>
          </section>
          <section style={{marginTop: 18}}>
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
          <section style={{marginTop: 18}}>
            <p className="eyebrow">Recent proxy errors</p>
            {errors.length === 0 ? <p className="note">No errors recorded. This does not prove the proxy works.</p> : errors.slice(0, 5).map(error => (
              <p className="note" key={error.at}>{error.title} · {error.detail}</p>
            ))}
          </section>
        </section>
      ) : null}
      {tab === 'settings' ? <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings"><SettingsPanel/></section> : null}
      {tab === 'check' ? <section id="panel-check" role="tabpanel" aria-labelledby="tab-check"><p className="note">This check requests getip.cloud. {checkRoute.reason} It tests that route, not every saved proxy or website. Confirm Chrome control status on Connection.</p><CheckPanel proxyHosts={settings.profiles.map(profile => profile.host)}/></section> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App/>);
