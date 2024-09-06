ROOT := $(shell pwd)
SYSTEM := $(shell uname -s)

## help: print this help message
.PHONY: help
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' |  sed -e 's/^/ /'

## test: run tests with coverage enabled
.PHONY: test
test:
	npm run build-and-test
