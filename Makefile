ROOT           := $(shell pwd)
NODE_MODULES   := $(ROOT)/node_modules
NODE_BIN       := $(NODE_MODULES)/.bin
NODE_VERSION   := $(shell node --version | sed 's/\..*//')
	
ALL_FILES := src/*.js
ESLINT := $(NODE_BIN)/eslint
JSCS := $(NODE_BIN)/jscs
MOCHA       := $(NODE_BIN)/mocha
_MOCHA      := $(NODE_BIN)/_mocha

.PHONY: all
all: clean lint codestyle testOrCoverage

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
	@npm run cover

# Run a coverage report if running under node 10, otherwise just run our tests
.PHONY: testOrCoverage
testOrCoverage: $(ALL_FILES)
ifeq ($(NODE_VERSION),v10)
	@echo Doing code coverage
	@npm run cover
else
	@echo Running under $(NODE_VERSION) - Just running tests
	@npm test
endif

.PHONY: report-coverage
report-coverage:
ifeq ($(NODE_VERSION),v10)
	curl -s https://codecov.io/bash  | bash
else
	@echo Not uploading code-coverage since running under $(NODE_VERSION)
endif

.PHONY: clean
clean:
	@rm -rf $(COVERAGE_FILES)
