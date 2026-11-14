'use strict';
// Preflight cannot accidentally reach a provider even if a test forgets its mock.
globalThis.fetch=async()=>{throw Error('Network forbidden in contract preflight; inject a request-only provider double');};
