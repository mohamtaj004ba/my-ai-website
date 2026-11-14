'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../lib/agent-operations-browser-service');
const origin = 'https://my-ai-website-abc123-mohamtaj004bas-projects.vercel.app';
const request = () => ({ binding: { environment: 'preview', branch: 'feature/callercore-dashboards', origin, sourceCommit: 'a'.repeat(40) }, url: origin + '/industries/legal', taskId: 'task-1', executionId: 'execution-1' });
test('browser accepts exact public Preview root and Legal bindings only', () => {
  assert.equal(service.validateRequest(request()).path, '/industries/legal');
  for (const url of [origin + '/admin-dashboard', origin + '/?token=x', 'http://127.0.0.1/', 'https://example.com/']) assert.throws(() => service.validateRequest({ ...request(), url }));
  assert.throws(() => service.validateRequest({ ...request(), cookies: [] }), /BROWSER_REQUEST_FIELDS/);
  assert.throws(() => service.validateRequest({ ...request(), binding: { ...request().binding, token: 'not-accepted' } }), /BROWSER_REQUEST_FIELDS/);
  assert.throws(() => service.validateRequest({ ...request(), binding: { ...request().binding, environment: 'production' } }));
});
test('responsive capture accepts only fixed desktop and mobile viewport presets',()=>{
  assert.deepEqual(service.validateRequest(request()).viewport,{width:1280,height:900});
  assert.deepEqual(service.validateRequest({...request(),viewport:'mobile'}).viewport,{width:390,height:844});
  for(const viewport of [{width:400,height:800},'tablet',null,100000])assert.throws(()=>service.validateRequest({...request(),viewport}),/BROWSER_VIEWPORT_DENIED/);
});
test('successful boundary fixture returns hashes and destroys its disposable context', async () => {
  let contextsClosed=0, browsersClosed=0;
  const page = { on() {}, goto: async () => ({ status: () => 200 }), url: () => request().url, evaluate: async () => ({ text: 'Synthetic boundary fixture', elements: [] }), screenshot: async () => Buffer.from('fixture-not-a-real-png') };
  const context = { route: async () => {}, newPage: async () => page, close: async () => { contextsClosed++; } };
  const playwright = { chromium: { launch: async () => ({ newContext: async () => context, close: async () => { browsersClosed++; } }) } };
  const result=await service.capturePublicPreview(request(), { egressIsolationVerified: true, runtime: 'dedicated-public-browser-v1', playwright });
  assert.match(result.screenshotHash, /^[a-f0-9]{64}$/);
  assert.equal(contextsClosed,1); assert.equal(browsersClosed,1);
  assert.deepEqual(result.cleanup,{contextClosed:true,browserClosed:true});
  assert.equal(result.taskId,'task-1');
});
test('cancellation during launch closes browser without navigation', async () => {
  const controller=new AbortController(); let navigations=0,closed=0;
  const playwright={chromium:{launch:async()=>{controller.abort();return {newContext:async()=>{navigations++;},close:async()=>{closed++;}};}}};
  await assert.rejects(service.capturePublicPreview(request(),{signal:controller.signal,egressIsolationVerified:true,runtime:'dedicated-public-browser-v1',playwright}),/BROWSER_CANCELLED/);
  assert.equal(navigations,0);assert.equal(closed,1);
});
test('failed cleanup cannot return successful evidence and quarantines the process', async () => {
  delete require.cache[require.resolve('../lib/agent-operations-browser-service')];
  const isolated=require('../lib/agent-operations-browser-service');
  const page={on(){},goto:async()=>({status:()=>200}),url:()=>request().url,evaluate:async()=>({text:'fixture',elements:[]}),screenshot:async()=>Buffer.from('fixture')};
  const context={route:async()=>{},newPage:async()=>page,close:async()=>{throw Error('private cleanup details');}};
  const options={egressIsolationVerified:true,runtime:'dedicated-public-browser-v1',playwright:{chromium:{launch:async()=>({newContext:async()=>context,close:async()=>{}})}}};
  await assert.rejects(isolated.capturePublicPreview(request(),options),error=>{assert.equal(error.code,'BROWSER_CLEANUP_UNCONFIRMED');assert.deepEqual(error.cleanup,{contextClosed:false,browserClosed:true});return true;});
  await assert.rejects(isolated.capturePublicPreview(request(),options),/BROWSER_CONCURRENCY_LIMIT/);
});
test('browser rejects private, reserved, IPv6 and mapped addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '198.18.0.1', '192.0.2.1', '203.0.113.1', '224.0.0.1', '::1', '::ffff:8.8.8.8']) assert.equal(service.isPublicAddress(address), false, address);
  assert.equal(service.isPublicAddress('8.8.8.8'), true);
});
test('request policy denies mutations, external origins and private/rebound DNS', async () => {
  const scope = service.validateRequest(request());
  const publicLookup = async () => [{ address: '8.8.8.8' }];
  assert.equal(await service.authorizeNetworkRequest(scope, origin + '/style.css', 'GET', publicLookup), true);
  for (const [url, method] of [[origin + '/api/agent-operations','GET'], [origin + '/', 'POST'], ['https://example.com/', 'GET']]) await assert.rejects(service.authorizeNetworkRequest(scope, url, method, publicLookup));
  await assert.rejects(service.authorizeNetworkRequest(scope, origin + '/', 'GET', async () => [{ address: '8.8.8.8' }, { address: '127.0.0.1' }]), /BROWSER_DNS_DENIED/);
  await assert.rejects(service.authorizeNetworkRequest(scope, origin + '/', 'GET', async () => []), /BROWSER_DNS_DENIED/);
});
test('no browser starts without separately verified dedicated egress infrastructure', async () => {
  let starts = 0;
  await assert.rejects(service.capturePublicPreview(request(), { playwright: { chromium: { launch() { starts++; } } } }), /BROWSER_INFRASTRUCTURE_UNVERIFIED/);
  assert.equal(starts, 0);
});
test('capture sanitizes runtime failures and releases concurrency after initialization failure', async () => {
  const options = { egressIsolationVerified: true, runtime: 'dedicated-public-browser-v1', playwright: { chromium: { launch: async () => { throw Error('secret-token private path'); } } } };
  for (let i=0; i<2; i++) await assert.rejects(service.capturePublicPreview(request(), options), { message: 'BROWSER_CAPTURE_FAILED' });
});
test('pre-cancelled capture cannot initialize browser', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.capturePublicPreview(request(), { signal: controller.signal, egressIsolationVerified: true, runtime: 'dedicated-public-browser-v1' }), /BROWSER_CANCELLED/);
});
