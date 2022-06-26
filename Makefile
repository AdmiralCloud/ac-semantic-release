commit:
	node ./lib/commit.js

release:
	node ./lib/release.js

test-release:
	DEBUGMODE=true node ./lib/release.js

lint-fix:
	./node_modules/.bin/eslint lib/*.js --fix