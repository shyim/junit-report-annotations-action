import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as github from '@actions/github';
import * as fs from 'fs';
import { parseString } from 'xml2js';
import { issueCommand } from './command';

const path = core.getInput('path');
const accessToken = core.getInput('accessToken') || '';
const jobName = core.getInput('jobName');
const stripFromPath = core.getInput('stripFromPath');
const errorLevel = core.getInput('errorLevel');

let sendToGithubUsingApi = async (annotations) => {
    if (accessToken.length === 0) {
        throw new Error('No accessToken');
    }

    const octokit = new github.GitHub(accessToken);
    const req = {
        ...github.context.repo,
        ref: github.context.sha
    }
    const res = await octokit.checks.listForRef(req);

    let checkRuns = res.data.check_runs.filter(check => check.name === jobName);

    if (checkRuns.length === 0) {
        const msg = `Cannot find check by name ${jobName}`;
        console.log(`${msg}, falling back to commands`);
    }

    const check_run_id = res.data.check_runs.filter(check => check.name === jobName)[0].id

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
};

let writeCommands = async (annotations) => {
    for (let annotation of annotations) {
        issueCommand(
            annotation.annotation_level === 'failure' ? 'error' : 'warning',
            {
                file: annotation.file,
                line: annotation.start_line.toString(),
                col: "0",
            },
            annotation.message
        )
    }
};

(async () => {
    try {
        const globber = await glob.create(path, {followSymbolicLinks: false});
        let annotations = [];

        for await (const file of globber.globGenerator()) {
            const data = await fs.promises.readFile(file);
            let json = await parseString(data);
        
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

                                annotations.push({
                                    path: file,
                                    start_line: line,
                                    end_line: line,
                                    start_column: 0,
                                    end_column: 0,
                                    annotation_level: errorLevel === 'error' ? 'failure' : 'warning',
                                    title: testsuite['$'].name + "::" + testCase['$'].name,
                                    message: testCase.failure[0]['_'],
                                });
                            }
                        }
                    }
                }
            }

            if (annotations.length === 0) {
                return;
            }

            try {
                await sendToGithubUsingApi(annotations);
            } catch (e) {
                await writeCommands(annotations);
            }
        }
    } catch(error) {
        core.setFailed(error.message);
    }
})();
