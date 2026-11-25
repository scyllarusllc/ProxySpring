"""ProxySpring website: FastAPI + Jinja2 templates. The proxy check itself runs in the visitor's browser."""
from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

HERE = Path(__file__).parent
templates = Jinja2Templates(directory=HERE / 'templates')
app = FastAPI(title='ProxySpring', docs_url=None, redoc_url=None, openapi_url=None)
app.mount('/static', StaticFiles(directory=HERE / 'static'), name='static')

# Scripts and styles come from this site, plus the statistics.diy tracker; the check page calls getip.cloud from the browser.
CSP = ("default-src 'self'; script-src 'self' https://statistics.diy; img-src 'self' data: https://statistics.diy; "
       "connect-src 'self' https://getip.cloud https://statistics.diy; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'none'")


@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault('Content-Security-Policy', CSP)
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response


def page(request: Request, name: str, title: str) -> HTMLResponse:
    return templates.TemplateResponse(request, name, {'title': title, 'path': request.url.path.rstrip('/') or '/'})


@app.get('/', response_class=HTMLResponse)
def home(request: Request):
    return page(request, 'home.html', 'ProxySpring')


@app.get('/check', response_class=HTMLResponse)
def check(request: Request):
    return page(request, 'check.html', 'Connection check · ProxySpring')


@app.get('/privacy', response_class=HTMLResponse)
def privacy(request: Request):
    return page(request, 'privacy.html', 'Privacy · ProxySpring')


@app.get('/favicon.ico', include_in_schema=False)
def favicon():
    return PlainTextResponse('', status_code=307, headers={'Location': '/static/favicon.svg'})


@app.get('/healthz', response_class=PlainTextResponse)
def healthz():
    return 'ok'
