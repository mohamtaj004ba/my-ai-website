'use strict';
// Trusted, read-only layer-A inventory. This is not a runner or sandbox attestation.
const fs = require('node:fs');
const MAX_BYTES = 65536;
const FILES = Object.freeze({status:'/proc/self/status',limits:'/proc/self/limits',controllers:'/sys/fs/cgroup/cgroup.controllers'});
function boundedRead(path) {
  let fd;
  try {
    fd = fs.openSync(path, 'r');
    const b = Buffer.alloc(MAX_BYTES + 1);
    const n = fs.readSync(fd, b, 0, b.length, 0);
    return n > MAX_BYTES ? null : b.subarray(0, n).toString('utf8');
  } catch { return null; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function text(value) { return typeof value === 'string' && Buffer.byteLength(value) <= MAX_BYTES ? value : null; }
function field(s, name, grammar) {
  if (s === null) return null;
  const lines = s.split('\n').filter(line => line.startsWith(name + ':'));
  if (lines.length !== 1) return null;
  const value = lines[0].slice(name.length + 1).trim();
  return grammar.test(value) ? value : null;
}
function inspect(input = {}) {
  const status = text(input.status), limits = text(input.limits), controllers = text(input.controllers);
  const uid = field(status, 'Uid', /^\d+\s+\d+\s+\d+\s+\d+$/);
  const caps = field(status, 'CapEff', /^[a-fA-F0-9]{16}$/);
  const nnp = field(status, 'NoNewPrivs', /^[01]$/);
  const seccomp = field(status, 'Seccomp', /^[012]$/);
  function limit(label) {
    if (limits === null) return 'unavailable';
    const rows = limits.split('\n').filter(line => line.startsWith(label + ' '));
    if (rows.length !== 1) return 'unavailable';
    const match = rows[0].slice(label.length).trim().match(/^(unlimited|\d+)\s+(unlimited|\d+)(?:\s+[a-z]+)?$/);
    if (!match) return 'unavailable';
    if (match[2] !== 'unlimited' && (match[1] === 'unlimited' || BigInt(match[1]) > BigInt(match[2]))) return 'unavailable';
    return match[1] === 'unlimited' ? 'unlimited' : 'finite-observed-not-tree-qualified';
  }
  const knownControllers = ['cpu','memory','pids','io','cpuset','hugetlb','rdma','misc','dmem'];
  const words = controllers === null || !controllers.trim() ? [] : controllers.trim().split(/\s+/);
  const validControllers = controllers !== null && words.every(w => knownControllers.includes(w)) && new Set(words).size === words.length;
  return {
    version:'source-execution-inventory-v1',
    observationOnly:true, qualified:false, generatedCodeExecutionAllowed:false,
    identity:{allUidValuesNonRoot:uid === null || uid.split(/\s+/).some(v => BigInt(v) > 4294967295n) ? null : uid.split(/\s+/).every(v => BigInt(v) !== 0n),effectiveCapabilitiesZero:caps === null ? null : /^0+$/.test(caps),noNewPrivileges:nnp === null ? null : nnp === '1',seccompMode:seccomp === null ? null : Number(seccomp)},
    processLimits:{cpu:limit('Max cpu time'),processes:limit('Max processes'),fileSize:limit('Max file size'),addressSpace:limit('Max address space')},
    availableCgroupControllers:validControllers ? knownControllers.filter(w => words.includes(w)) : null,
    unresolved:['effective-task-cgroup-membership-and-tree-limits','filesystem-and-total-disk-confinement','privilege-escalation-paths','network-policy-and-egress','image-and-provider-identity','cancellation-and-provider-cleanup','source-test-integrity','resource-spending-authorization'],
  };
}
function inventory() {
  if (process.platform !== 'linux') return {version:'source-execution-inventory-v1',observationOnly:true,qualified:false,generatedCodeExecutionAllowed:false,code:'QUAL_PLATFORM_UNSUPPORTED'};
  return inspect(Object.fromEntries(Object.entries(FILES).map(([key,path]) => [key,boundedRead(path)])));
}
if (require.main === module) process.stdout.write(JSON.stringify(inventory()) + '\n');
module.exports = {inspect,inventory};
