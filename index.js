const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');
const fs = require('fs');
var parseString = require('xml2js').parseStringPromise;

(async () => {
    try {
        const path = core.getInput('path');
        const stripFromPath = core.getInput('stripFromPath');
        const accessToken = core.getInput('accessToken');
        
        const globber = await glob.create(path, {followSymbolicLinks: false});
        let annotations = [];

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

                                if (stripFromPath) {
                                    file = file.replace(stripFromPath, '')
                                }

                                annotations.push({
                                    path: file,
                                    start_line: testCase['$'].line || '0',
                                    end_line: testCase['$'].line || '0',
                                    start_column: 0,
                                    end_column: 0,
                                    annotation_level: 'failure',
                                    message: testCase.failure[0]['_'],
                                });
                            }
                        }
                    }
                }
            }

            console.log(annotations);

            if (annotations.length === 0) {
                return;
            }

            const octokit = new github.GitHub(accessToken);
            const req = {
                ...github.context.repo,
                ref: github.context.sha
            }
            const res = await octokit.checks.listForRef(req);
            console.log(res);
            const check_run_id = res.data.check_runs.filter(check => check.name === 'build')[0].id

            const update_req = {
                ...github.context.repo,
                check_run_id,
                output: {
                    title: "Junit Results",
                    summary: `jUnit Results`,
                    annotations: annotations
                }
            }
            await octokit.checks.update(update_req);
        }
    } catch(error) {
        core.setFailed(error.message);
    }
})();