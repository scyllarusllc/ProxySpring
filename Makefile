.DEFAULT_GOAL := help
PORT ?= 8081
VENV := .venv
NPM_STAMP := node_modules/.installed
PY_STAMP := $(VENV)/.installed

.PHONY: help install assets dev run test typecheck check build

help:
	@printf '%s\n' 'make install    Install npm and Python (FastAPI, Jinja2) dependencies.'
	@printf '%s\n' 'make assets     Build the website CSS, check script and Font Awesome into app/static.'
	@printf '%s\n' 'make dev        Run the website with auto-reload at http://127.0.0.1:$(PORT).'
	@printf '%s\n' 'make run        Run the website without reload.'
	@printf '%s\n' 'make test       Run the proxy and checker tests.'
	@printf '%s\n' 'make typecheck  Typecheck the website script, extension and shared code.'
	@printf '%s\n' 'make check      Run typecheck and tests.'
	@printf '%s\n' 'make build      Typecheck, build the website assets and write dist/extension.'

install: $(NPM_STAMP) $(PY_STAMP)

$(NPM_STAMP): package.json package-lock.json
	npm ci --no-audit --no-fund
	touch $@

$(PY_STAMP): requirements.txt
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r requirements.txt
	touch $@

assets: $(NPM_STAMP)
	npm run build:web

dev: install assets
	$(VENV)/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port $(PORT)

run: install assets
	$(VENV)/bin/uvicorn app.main:app --host 127.0.0.1 --port $(PORT)

test: $(NPM_STAMP)
	npm test

typecheck: $(NPM_STAMP)
	npm run typecheck

check: typecheck test

build: $(NPM_STAMP)
	npm run build
