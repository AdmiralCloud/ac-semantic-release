commit:
	node ./lib/commit.js

release:
	node ./lib/release.js

test-release:
	DEBUGMODE=true node ./lib/release.js

audit:
	node ./lib/audit.js

lint-check:
	./node_modules/.bin/eslint *.js lib/*.js

lint-fix:
	./node_modules/.bin/eslint *.js lib/*.js --fix