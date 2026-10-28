'use strict';
// Fixed trusted qualification command only. No provider calls or command execution.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const NODES = Object.freeze(['/usr/bin/node', '/usr/local/bin/node']);
function probeCommand(nodePath) {
  if (arguments.length !== 1 || !NODES.includes(nodePath)) throw Error('QUAL_NODE_PATH_DENIED');
  const inventory = fs.readFileSync(path.join(__dirname, 'source-execution-inventory.cjs'), 'utf8');
  const code = inventory + `
const raw = boundedRead('/proc/self/status');
const zeroCap = name => {const v=field(raw,name,/^[a-fA-F0-9]{16}$/);return v===null?null:/^0+$/.test(v);};
const groupText = field(raw,'Groups',/^(?:[0-9]+(?:\\s+[0-9]+)*)?$/);
const gid = field(raw,'Gid',/^[0-9]+\\s+[0-9]+\\s+[0-9]+\\s+[0-9]+$/);
const expectedIds = value => value===null?null:value.split(/\\s+/).every(v=>v==='65534');
const observed = inventory();
const checks = {nonRootUid:expectedIds(field(raw,'Uid',/^[0-9]+\\s+[0-9]+\\s+[0-9]+\\s+[0-9]+$/)),nonRootGid:expectedIds(gid),noSupplementaryGroups:groupText===null?null:groupText==='',noNewPrivileges:observed.identity?.noNewPrivileges??null,effectiveCapabilitiesZero:zeroCap('CapEff'),permittedCapabilitiesZero:zeroCap('CapPrm'),inheritableCapabilitiesZero:zeroCap('CapInh'),ambientCapabilitiesZero:zeroCap('CapAmb'),boundingCapabilitiesZero:zeroCap('CapBnd')};
const passed = Object.values(checks).every(value=>value===true);
const probeSourceSha256 = require('node:crypto').createHash('sha256').update(process.execArgv[1]).digest('hex');
process.stdout.write(JSON.stringify({version:'source-privilege-probe-v1',probeSourceSha256,runtime:process.version,checks,privilegeProbePassed:passed,qualified:false,generatedCodeExecutionAllowed:false})+'\\n');
process.exitCode=passed?0:1;
`;
  return {
    version:'source-privilege-probe-command-v1',
    command:'/usr/bin/setpriv',
    args:['--no-new-privs','--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--reuid=65534','--regid=65534','--clear-groups','--reset-env','--',nodePath,'-e',code],
    sudo:true,
    timeout:15000,
    probeSourceSha256:crypto.createHash('sha256').update(code).digest('hex'),
    inventorySha256:crypto.createHash('sha256').update(inventory).digest('hex'),
    qualified:false,
    generatedCodeExecutionAllowed:false,
  };
}
module.exports = {probeCommand};
