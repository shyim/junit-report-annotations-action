const core = require('@actions/core');
const glob = require('@actions/glob');
const fs = require('fs');
var parseString = require('xml2js').parseStringPromise;

(async () => {
    try {
        const path = core.getInput('path');
        const stripFromPath = core.getInput('stripFromPath');
        const errorLevel = core.getInput('errorLevel');

        const globber = await glob.create(path, {followSymbolicLinks: false});

        for await (const file of globber.globGenerator()) {
            const data = await fs.promises.readFile(file);
            var json = await parseString(data);
        
            if (json.testsuites === undefined) {
                continue;
            }

            for (let row of json.testsuites.testsuite) {
                if (row.testcase !== undefined) {
                    row.testsuite = [row];
                }

                for (let testsuite of row.testsuite) {
                    if (testsuite['$']['errors'] !== '0' || testsuite['$']['failures'] !== '0') {
                        for (let testCase of testsuite.testcase) {
                            if (testCase.failure) {
                                let file = testCase['$'].file;
                                let line = testCase['$'].line || '1';

                                if (stripFromPath) {
                                    file = file.replace(stripFromPath, '')
                                }

                                if (line === '0') {
                                    line = '1';
                                }

                                core.issueCommand(
                                    errorLevel,
                                    {
                                        file: file,
                                        line: line,
                                        col: line,
                                    },
                                    testCase.failure[0]['_']
                                )
                            }
                        }
                    }
                }
            }
        }
    } catch(error) {
        core.setFailed(error.message);
    }
})();
