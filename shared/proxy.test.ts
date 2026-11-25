import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyProxyError, buildPac, emptySettings, explainTab, parseProxyLine, resolve, webRtcPolicy, type Settings} from './proxy';
import {controlFromChrome} from '../extension/src/control';
import {compareTimezone, compareWebRtc, flagText, httpFailureMessage, loadExitReport, normalizeGetip} from './check';

test('blocks non-proxied WebRTC only while takeover and the switch are on', () => {
  const settings = emptySettings();
  assert.equal(webRtcPolicy(settings), 'default');
  assert.equal(webRtcPolicy({...settings, enabled: true}), 'disable_non_proxied_udp');
  assert.equal(webRtcPolicy({...settings, enabled: true, blockWebRtcLeak: false}), 'default');
});

test('parses common proxy lines and socks alias', () => {
  const http = parseProxyLine('http://user:p%40ss@proxy.example:8080');
  assert.deepEqual(http, {scheme: 'http', host: 'proxy.example', port: 8080, username: 'user', password: 'p@ss'});
  const socks = parseProxyLine('socks://10.0.0.8:1080');
  assert.equal('scheme' in socks && socks.scheme, 'socks5');
  assert.equal('error' in parseProxyLine('http://bad'), true);
});

test('parses the four credential layouts with http as default scheme', () => {
  const expected = {scheme: 'http', host: '204.16.235.167', port: 12323, username: '14a4e19af0a79', password: 'd6ecb96ba3'};
  for (const line of [
    '204.16.235.167:12323:14a4e19af0a79:d6ecb96ba3',
    '204.16.235.167:12323@14a4e19af0a79:d6ecb96ba3',
    '14a4e19af0a79:d6ecb96ba3:204.16.235.167:12323',
    '14a4e19af0a79:d6ecb96ba3@204.16.235.167:12323',
  ]) assert.deepEqual(parseProxyLine(line), expected, line);
  for (const scheme of ['https', 'socks4', 'socks5']) {
    const parsed = parseProxyLine(`${scheme}://204.16.235.167:12323:u:p`);
    assert.deepEqual(parsed, {...expected, scheme, username: 'u', password: 'p'});
  }
  assert.deepEqual(parseProxyLine('10.0.0.1:8080'), {scheme: 'http', host: '10.0.0.1', port: 8080, username: '', password: ''});
  assert.deepEqual(parseProxyLine('proxy.example:8080:user:12345'), {scheme: 'http', host: 'proxy.example', port: 8080, username: 'user', password: '12345'});
  assert.equal('error' in parseProxyLine('a:b:c'), true);
  assert.equal('error' in parseProxyLine('1.2.3.4:99999'), true);
});

test('rules beat the default and local hosts stay direct', () => {
  const settings: Settings = {
    enabled: true,
    blockWebRtcLeak: true,
    defaultProfileId: 'home',
    profiles: [
      {id: 'home', name: 'Home', scheme: 'http', host: 'h.example', port: 8000, username: '', password: ''},
      {id: 'work', name: 'Work', scheme: 'socks5', host: 'w.example', port: 1080, username: 'a', password: 'b'},
    ],
    rules: [{id: 'r1', pattern: 'news.example', profileId: 'work'}, {id: 'r2', pattern: '*.direct.example', profileId: 'direct'}],
  };
  assert.match(resolve(settings, 'www.news.example').reason, /Work/);
  assert.equal(resolve(settings, 'a.direct.example').profileId, 'direct');
  assert.equal(resolve(settings, 'other.example').profile?.name, 'Home');
  assert.match(resolve(settings, 'localhost').reason, /directly/);
  const off = emptySettings();
  assert.match(resolve(off, 'example.com').reason, /management is off/);
  assert.match(explainTab('chrome-extension://nmpkmadhcfkmmpinalcgdcgehagnnkgc/options.html', settings).reason, /not a website/);
  assert.match(explainTab('https://www.news.example/a', settings).reason, /Work/);
});

test('pac quotes profile tokens and skips invalid patterns', () => {
  const settings: Settings = {
    enabled: true,
    blockWebRtcLeak: true,
    defaultProfileId: 'direct',
    profiles: [{id: 's', name: "O'Reilly", scheme: 'https', host: 'edge.example', port: 443, username: '', password: ''}],
    rules: [{id: '1', pattern: 'bad host', profileId: 's'}, {id: '2', pattern: 'ok.example', profileId: 's'}],
  };
  const pac = buildPac(settings);
  assert.match(pac, /HTTPS edge\.example:443/);
  assert.doesNotMatch(pac, /bad host/);
  assert.match(pac, /ok\.example/);
});

test('classifies proxy failures without collapsing them into unknown', () => {
  assert.equal(classifyProxyError('net::ERR_PROXY_CONNECTION_FAILED').kind, 'port');
  assert.equal(classifyProxyError('net::ERR_SOCKS_CONNECTION_FAILED').kind, 'protocol');
  assert.equal(classifyProxyError('net::ERR_PROXY_AUTH_REQUESTED').kind, 'auth');
  assert.equal(classifyProxyError('net::ERR_TUNNEL_CONNECTION_FAILED').kind, 'tunnel');
  assert.equal(classifyProxyError('net::ERR_CONNECTION_RESET', false).kind, 'target');
  assert.equal(classifyProxyError('net::ERR_UNEXPECTED').kind, 'unknown');
});

test('ip report keeps absent flags distinct from unmarked', () => {
  const report = normalizeGetip({
    ip: '203.0.113.8',
    version: 'IPv4',
    country: 'Japan',
    city: 'Tokyo',
    region: 'Tokyo',
    countryCode: 'JP',
    countryFlag: '🇯🇵',
    asn: 2516,
    organization: 'Example ISP',
    timezone: 'Asia/Tokyo',
  }, '2026-04-01T00:00:00.000Z');
  assert.equal(report.asn, 'AS2516');
  assert.equal(report.flag, '🇯🇵');
  assert.equal(report.region, 'Tokyo');
  assert.equal(report.city, 'Tokyo');
  assert.equal(report.timezone, 'Asia/Tokyo');
  assert.match(flagText('VPN', report.vpn, 'getip.cloud'), /does not provide/);
  assert.equal(normalizeGetip({asn: null, timezone: null}, 't').status, 'unavailable');
  assert.match(compareTimezone('Asia/Shanghai', 'Asia/Tokyo').text, /differs/);
  assert.equal(compareWebRtc('203.0.113.8', []).state, 'none');
  assert.equal(compareWebRtc('203.0.113.8', ['198.51.100.4']).state, 'different');
  assert.match(httpFailureMessage(429), /429/);
});

test('loads the exit report from getip.cloud', async () => {
  const calls: string[] = [];
  const report = await loadExitReport(async url => {
    calls.push(url);
    return {ok: true, status: 200, json: async () => ({ip: '203.0.113.9', country: 'Japan', city: 'Tokyo', region: 'Tokyo', countryCode: 'JP', countryFlag: '🇯🇵', version: 'IPv4'})};
  });
  assert.equal(report.status, 'ok');
  assert.equal(report.source, 'getip.cloud');
  assert.equal(report.city, 'Tokyo');
  assert.deepEqual(calls, ['https://getip.cloud/json']);
});

test('PAC rules require a domain boundary, matching the preview decision', () => {
  const settings={...emptySettings(),enabled:true,rules:[{id:'one',pattern:'example.com',profileId:'direct'}]};
  const pac=buildPac(settings);
  assert.match(pac,/dnsDomainIs\(host, '\.example\.com'\)/);
  assert.doesNotMatch(pac,/dnsDomainIs\(host, 'example\.com'\)/);
  assert.equal(resolve(settings,'notexample.com').reason.includes('No rule matched'),true);
});

test('proxy control distinguishes active, blocked and other-extension states',()=>{
  assert.equal(controlFromChrome('controlled_by_this_extension',true),'active');
  assert.equal(controlFromChrome('controlled_by_other_extensions',true),'controlled-elsewhere');
  assert.equal(controlFromChrome('not_controllable',true),'blocked');
  assert.equal(controlFromChrome('controlled_by_this_extension',false),'off');
});
