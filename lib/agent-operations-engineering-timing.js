'use strict';
// Existing phase budgets in one place. Phase changes never extend the immutable
// task/approval deadline; the controller reserves shutdown time separately.
const OPERATION_MS=600000,SHUTDOWN_MS=15000,MODEL_MS=150000;
// Assignment preparation is not paid execution. Give reviewed implementation
// tasks time for consent and release readback without consuming their run window.
// The activation controller still caps each fresh approval/run at OPERATION_MS.
const ASSIGNMENT_MS=1800000;
const LIVE_MODEL_MS=MODEL_MS-SHUTDOWN_MS,SOURCE_TEST_MS=300000,SOURCE_COMMAND_MS=150000;
function phaseDeadline(now,duration,operationDeadline){
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(duration)||duration<1||!Number.isSafeInteger(operationDeadline))throw Error('ENG_TRANSPORT_DEADLINE');
 return Math.min(now+duration,operationDeadline);
}
module.exports={ASSIGNMENT_MS,OPERATION_MS,SHUTDOWN_MS,MODEL_MS,LIVE_MODEL_MS,SOURCE_TEST_MS,SOURCE_COMMAND_MS,phaseDeadline};
