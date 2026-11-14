'use strict';
// Local verification only. Never use local SQLite in a Vercel request lifecycle.
function sqliteAdapter(path){
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)');
  return {
    read:async()=>db.prepare('SELECT value FROM ledger WHERE id=1').get()?.value??null,
    compare:async(before,after)=>{
      db.exec('BEGIN IMMEDIATE');
      try{const current=db.prepare('SELECT value FROM ledger WHERE id=1').get()?.value??null;
        if(current!==before){db.exec('ROLLBACK');return false;}
        db.prepare('INSERT INTO ledger(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(after);db.exec('COMMIT');return true;
      }catch(e){db.exec('ROLLBACK');throw e;}
    },close:()=>db.close()
  };
}
module.exports={sqliteAdapter};
