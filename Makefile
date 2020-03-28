commit:
	node ./lib/commit.js
	
lint-fix:
	./node_modules/.bin/eslint lib/*.js --fix