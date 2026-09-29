if [ $# -eq 0 ]
  then
    TEST_PATH=./**/tests/**/*.spec.ts
    export IS_TEST=true
    ./scripts/runner.sh ./node_modules/.bin/tape $TEST_PATH | ./node_modules/.bin/tap-spec
else
    export IS_TEST=true
    ./scripts/runner.sh ./node_modules/.bin/tape "$@" | ./node_modules/.bin/tap-spec
fi