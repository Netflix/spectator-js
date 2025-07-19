ROOT := $(shell pwd)
SYSTEM := $(shell uname -s)

## help: print this help message
.PHONY: help
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' |  sed -e 's/^/ /'

## build: run build
.PHONY: build
build:
	npm run build

## test: run build-and-test
.PHONY: test
test:
	npm run build-and-test

## coverage: run test-with-coverage
.PHONY: coverage
coverage:
	npm run test-with-coverage
