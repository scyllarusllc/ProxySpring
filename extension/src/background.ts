import {authWarning, buildPac, classifyProxyError, resolve, webRtcPolicy} from '../../shared/proxy';
import {ERRORS_KEY, SETTINGS_KEY, loadSettings, type ErrorEvent} from './storage';

async function applyWebRtc(settings: Awaited<ReturnType<typeof loadSettings>>) {
  const policy = chrome.privacy?.network?.webRTCIPHandlingPolicy;
  if (!policy) return;
  const value = webRtcPolicy(settings);
  if (value === 'default') await policy.clear({scope: 'regular'});
  else await policy.set({value, scope: 'regular'});
}

async function apply() {
  const settings = await loadSettings();
  await applyWebRtc(settings);
  if (!settings.enabled) {
    await chrome.proxy.settings.clear({scope: 'regular'});
    return;
  }
  await chrome.proxy.settings.set({
    scope: 'regular',
    value: {mode: 'pac_script', pacScript: {data: buildPac(settings)}},
  });
}

async function openApp() {
  const url = chrome.runtime.getURL('app.html');
  const existing = await chrome.tabs.query({url});
  const tab = existing[0];
  if (tab?.id !== undefined) {
    await chrome.tabs.update(tab.id, {active: true});
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, {focused: true});
    return;
  }
  await chrome.tabs.create({url});
}

chrome.action.onClicked.addListener(() => void openApp());
chrome.runtime.onInstalled.addListener(() => void apply());
chrome.runtime.onStartup.addListener(() => void apply());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) void apply();
});
void apply();

chrome.proxy.onProxyError.addListener(details => {
  const diagnosis = classifyProxyError(details.error, details.fatal);
  const event: ErrorEvent = {...diagnosis, at: new Date().toISOString(), raw: details.error};
  void chrome.storage.local.get(ERRORS_KEY).then(stored => {
    const previous = Array.isArray(stored[ERRORS_KEY]) ? stored[ERRORS_KEY] as ErrorEvent[] : [];
    return chrome.storage.local.set({[ERRORS_KEY]: [event, ...previous].slice(0, 20)});
  });
});

chrome.webRequest.onAuthRequired.addListener((details, callback): chrome.webRequest.BlockingResponse | undefined => {
  if (!callback) return;
  if (!details.isProxy) {
    callback({});
    return;
  }
  void loadSettings().then(settings => {
    let host = '';
    try { host = new URL(details.url).hostname; } catch { host = ''; }
    const decision = resolve(settings, host);
    const profile = decision.profile;
    const challenger = details.challenger;
    if (!profile || !profile.username || authWarning(profile) || challenger?.host !== profile.host || challenger.port !== profile.port) {
      callback({});
      return;
    }
    callback({authCredentials: {username: profile.username, password: profile.password}});
  }).catch(() => callback({}));
  return undefined;
}, {urls: ['<all_urls>']}, ['asyncBlocking']);
