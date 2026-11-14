'use strict';
// Disposable local verification only. This process never loads API credentials.
const {sqliteAdapter}=require('./agent-operations-sqlite.cjs');
const {createStore}=require('../lib/agent-operations-store');
const {runStage,mockAdapter}=require('../lib/agent-operations-worker');
async function main(){
  const [db,id,origin,commit]=process.argv.slice(2);if(!db||!id)throw new Error('Database and task ID required');
  const adapter=sqliteAdapter(db),store=createStore(adapter,{scope:{origin,commit}});
  try{const out=await runStage(store,mockAdapter(),{taskId:id});process.stdout.write(JSON.stringify({taskId:out.id,status:out.status,stage:out.stage,mode:'mock'})+'\n');}finally{adapter.close();}
}
if(require.main===module)main().catch(()=>{process.stderr.write('Local mock worker stopped.\n');process.exitCode=1;});
