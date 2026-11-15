export type ProxyControl = 'active' | 'pending' | 'controlled-elsewhere' | 'blocked' | 'off' | 'unknown';

export function controlFromChrome(level: string | undefined, enabled: boolean): ProxyControl {
  if (!enabled) return 'off';
  if (level === 'controlled_by_this_extension') return 'active';
  if (level === 'controlled_by_other_extensions') return 'controlled-elsewhere';
  if (level === 'not_controllable') return 'blocked';
  return 'unknown';
}

export async function readProxyControl(enabled: boolean, expectedPac?: string): Promise<ProxyControl> {
  if (!enabled) return 'off';
  try {
    const value = await chrome.proxy.settings.get({incognito: false});
    const level=controlFromChrome(value.levelOfControl, enabled);
    if(level==='active' && expectedPac && (value.value?.mode!=='pac_script' || value.value.pacScript?.data!==expectedPac))return 'pending';
    return level;
  } catch { return 'unknown'; }
}

export function controlMessage(control: ProxyControl): string {
  return {
    pending: 'ProxySpring is applying the saved route. If this persists, reload the extension and check for errors.',
    active: 'Chrome confirms ProxySpring controls its proxy setting.',
    'controlled-elsewhere': 'Another extension controls Chrome’s proxy setting. ProxySpring’s saved choice is not active.',
    blocked: 'Chrome policy prevents ProxySpring from controlling the proxy.',
    off: 'ProxySpring is off. Chrome uses its current system or other extension settings.',
    unknown: 'ProxySpring’s saved choice is on, but Chrome has not confirmed it is active.',
  }[control];
}
