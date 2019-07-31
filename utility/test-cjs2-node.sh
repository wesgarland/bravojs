#! /bin/sh
#
# @file		test-cjs2-node.sh
#		Run the CommonJS/2.0 version of the iojs test suite against
#		the cjs2-node.js shim.
# @author	Wes Garland, wes@kingsds.network
# @date		July 2019
#

cd "`dirname \"$0\"`"
shimFile="`pwd`/cjs2-node.js"
testsDir="`pwd`/../demos/iojs_tests/tests/modules/2.0"

find "$testsDir" -type d -name '[a-z]*' -prune \
| while read dir
  do
    cd "$dir"
    NODE_PATH="$dir" node -r "$shimFile" program.js
  done
