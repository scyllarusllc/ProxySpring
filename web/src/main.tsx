import React from 'react';
import {createRoot} from 'react-dom/client';
import {CheckPanel} from '../../shared/CheckPanel';
import '../../shared/theme.css';

function Shell({children}: {children: React.ReactNode}) {
  const path = location.pathname.replace(/\/$/, '') || '/';
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <svg className="mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4c2 6 2 9 0 14 5-1 9 1 11 5-7 1-11 0-14 5-1-6-5-9-9-10 5-1 8-5 12-14z" fill="#587c60"/></svg>
          ProxySpring
        </a>
        <nav>
          <a className={path === '/' ? 'active' : ''} href="/">产品</a>
          <a className={path === '/check' ? 'active' : ''} href="/check">检测</a>
          <a className={path === '/privacy' ? 'active' : ''} href="/privacy">隐私</a>
        </nav>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

function Home() {
  return (
    <Shell>
      <p className="eyebrow">自有代理 · CHROME</p>
      <h1 className="display">把代理配置<br/><em>说清楚。</em></h1>
      <p className="lede">保存多条线路，按域名分流，并在连接失败时区分端口、协议、认证、隧道和目标网站。线路由你提供，ProxySpring 不出售代理 IP。</p>
      <div className="row">
        <a className="button primary" href="/check">检查当前连接</a>
        <a className="button secondary" href="#install">安装扩展</a>
      </div>
      <section className="grid">
        <article className="card"><h2>配置与导入</h2><p>识别 http、https、socks4、socks5 地址，分开保存协议、服务器、端口和认证。SOCKS 用户名不会被 Chrome 发出。</p></article>
        <article className="card"><h2>切换与分流</h2><p>手动切换默认配置。规则按域名匹配，包含子域名。弹出窗口写明当前网站命中哪一条，以及为什么。</p></article>
        <article className="card"><h2>连接诊断</h2><p>根据浏览器的代理错误区分端口不可达、协议不匹配、认证失败、隧道失败、目标网站异常。对不上号就标成未知。</p></article>
        <article className="card"><h2>出口检测</h2><p>网站和扩展查询 getip.cloud。它不提供 VPN、代理或 Tor 标签。未检测到、数据源不可用和未执行分开显示。</p></article>
      </section>
      <section className="card" id="install" style={{marginTop: 14}}>
        <h2>安装扩展</h2>
        <p>在仓库运行 <code>npm run build</code>，打开 chrome://extensions，开启开发者模式，加载 <code>dist/extension</code>。本地地址始终直连。扩展只在你打开接管之后改写代理。</p>
      </section>
      <footer className="site-footer"><span>ProxySpring</span><span>首版面向 Chrome Manifest V3</span></footer>
    </Shell>
  );
}

function Check() {
  return (
    <Shell>
      <p className="eyebrow">VPN / PROXY CHECKER</p>
      <h1 className="display">看这次请求<br/><em>从哪出去。</em></h1>
      <p className="lede">结果描述数据源标记和观察到的出口，不判断你是否安装了某个 VPN。扩展的分流可能让其他网站走另一条出口。</p>
      <section className="card" style={{marginTop: 22}}><CheckPanel/></section>
    </Shell>
  );
}

function Privacy() {
  return (
    <Shell>
      <p className="eyebrow">PRIVACY</p>
      <h1 className="display">配置留在<br/><em>这台浏览器。</em></h1>
      <section className="card" style={{marginTop: 22}}>
        <p>ProxySpring 在 Chrome 本地存储代理地址、用户名、密码、分流规则、开关状态，以及最近 20 条代理错误及其时间。诊断记录可能包含浏览器返回的错误文字。扩展不会把这些配置或记录发送给我们。</p>
        <p style={{marginTop: 12}}>点击出口检测时，网站或扩展会向 getip.cloud 请求 IP、地区、运营商、ASN 等信息。对方会收到该请求的来源 IP；若启用了分流，这只反映访问 getip.cloud 的出口。我们未接入 VPN、代理或 Tor 风险标签数据源。</p>
        <p style={{marginTop: 12}}>WebRTC 检测仅在点击按钮后使用 Google 的 stun.l.google.com:19302；STUN 服务可能看到连接来源 IP。检测到的地址仅在当前页面展示，不保存。无需摄像头或麦克风权限。</p>
        <p style={{marginTop: 12}}>扩展使用代理权限写入 Chrome 代理设置；隐私权限在用户开启相应开关时调整 WebRTC IP 处理策略；存储权限保存本地配置与错误；标签页权限读取当前网站地址并打开设置页；网络请求及认证权限仅用于为匹配的 HTTP/HTTPS 代理提供账号密码。为这些功能需要访问各网站请求，但不读取网页正文。关闭代理接管会清除扩展写入的代理设置。</p>
        <p style={{marginTop: 12}}>本项目尚无用户账号、分析统计、广告或自有后端。删除扩展会移除 Chrome 保存的扩展本地数据。第三方服务的数据处理请参阅其各自政策。政策随产品功能变化更新；当前版本为 2026 年 11 月 14 日。</p>
      </section>
    </Shell>
  );
}

const path = location.pathname.replace(/\/$/, '') || '/';
createRoot(document.getElementById('root')!).render(path === '/check' ? <Check/> : path === '/privacy' ? <Privacy/> : <Home/>);
