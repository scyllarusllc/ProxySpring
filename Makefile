.DEFAULT_GOAL := help

NPM_STAMP := node_modules/.installed

.PHONY: help install dev test typecheck check build

help:
	@printf '%s\n' 'make install    Install dependencies from package-lock.json.'
	@printf '%s\n' 'make dev        Start the website at http://127.0.0.1:5173.'
	@printf '%s\n' 'make test       Run the proxy and checker tests.'
	@printf '%s\n' 'make typecheck  Typecheck the website, extension and shared code.'
	@printf '%s\n' 'make check      Run typecheck and tests.'
	@printf '%s\n' 'make build      Typecheck and write dist/web and dist/extension.'

install: $(NPM_STAMP)

$(NPM_STAMP): package.json package-lock.json
	npm ci --no-audit --no-fund
	touch $@

dev: $(NPM_STAMP)
	npm run dev

test: $(NPM_STAMP)
	npm test

typecheck: $(NPM_STAMP)
	npm run typecheck

check: typecheck test

build: $(NPM_STAMP)
	npm run build
