ROOT           := $(shell pwd)
NODE_MODULES   := $(ROOT)/node_modules
NODE_BIN       := $(NODE_MODULES)/.bin
	
ALL_FILES := src/*.js
ESLINT := $(NODE_BIN)/eslint
JSCS := $(NODE_BIN)/jscs
MOCHA       := $(NODE_BIN)/mocha
_MOCHA      := $(NODE_BIN)/_mocha
ISTANBUL    := $(NODE_BIN)/istanbul
COVERALLS   := $(NODE_BIN)/coveralls

.PHONY: all
all: clean lint codestyle test

.PHONY: lint
lint:
	@$(ESLINT) $(ALL_FILES)

.PHONY: codestyle
codestyle:
	@$(JSCS) $(ALL_FILES)

.PHONY: codestyle-fix
codestyle-fix:
	@$(JSCS) $(ALL_FILES) --fix

.PHONY: test
test:
	@npm test

.PHONY: coverage
coverage: node_modules $(ALL_FILES)
	@$(ISTANBUL) cover $(_MOCHA) --report json-summary --report html -- -R spec
	@$(COVERAGE_BADGE)


.PHONY: report-coverage
report-coverage: coverage
	@cat $(LCOV) | $(COVERALLS)


.PHONY: clean
clean:
	@rm -rf $(COVERAGE_FILES)
