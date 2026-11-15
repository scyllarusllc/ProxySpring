const STUN = 'stun:stun.l.google.com:19302';

export const STUN_LABEL = 'stun.l.google.com:19302';

export function collectSrflx(timeoutMs = 4000): Promise<string[]> {
  return new Promise(resolve => {
    const found = new Set<string>();
    let settled = false;
    const pc = new RTCPeerConnection({iceServers: [{urls: STUN}]});
    const finish = () => {
      if (settled) return;
      settled = true;
      pc.close();
      resolve([...found]);
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.onicecandidate = event => {
      if (!event.candidate) {
        clearTimeout(timer);
        finish();
        return;
      }
      const match = / ([^\s]+) \d+ typ srflx/i.exec(event.candidate.candidate);
      if (match) found.add(match[1]);
    };
    pc.createDataChannel('proxyspring');
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {
      clearTimeout(timer);
      finish();
    });
  });
}
