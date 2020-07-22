import * as os from 'os'

// For internal use, subject to change.

export function issueCommand(
    command,
    properties,
    message
) {
    const cmd = new Command(command, properties, message)
    process.stdout.write(cmd.toString() + os.EOL)
}

export function issue(name, message = '') {
    issueCommand(name, {}, message)
}

const CMD_STRING = '::'

class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command'
        }

        this.command = command
        this.properties = properties
        this.message = message
    }

    toString() {
        let cmdStr = CMD_STRING + this.command

        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' '
            let first = true
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key]
                    if (val) {
                        if (first) {
                            first = false
                        } else {
                            cmdStr += ','
                        }

                        cmdStr += `${key}=${escapeProperty(val)}`
                    }
                }
            }
        }

        cmdStr += `${CMD_STRING}${escapeData(this.message)}`
        return cmdStr
    }
}

function escapeData(s) {
    return (s || '')
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
}

function escapeProperty(s) {
    return (s || '')
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C')
}