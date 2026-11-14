import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const currentDir=path.resolve(process.argv[2]||'qa-artifacts');
const previousDir=path.resolve(process.argv[3]||'');
const reportFile=path.join(currentDir,'visual-diff.json');
const keyScreens=[
  'client-overview-initial.png',
  'admin-overview-initial.png',
  'client-mobile-overview.png',
  'admin-mobile-overview.png',
  'client-mobile-calls.png',
  'admin-mobile-clients.png'
];

async function exists(file){try{await fs.access(file);return true}catch{return false}}
const report={available:false,baselineDir:previousDir,comparisons:[],warningThreshold:0.25,failThreshold:0.65};

if(!previousDir||!(await exists(previousDir))){
  report.note='No previous successful QA artifact was available; current screenshots become the next comparison point.';
  await fs.writeFile(reportFile,JSON.stringify(report,null,2));
  process.exit(0);
}

report.available=true;
let severe=false;
for(const file of keyScreens){
  const current=path.join(currentDir,file),previous=path.join(previousDir,file);
  if(!(await exists(current))||!(await exists(previous))){
    report.comparisons.push({file,status:'missing-baseline'});
    continue;
  }
  const a=PNG.sync.read(await fs.readFile(previous)),b=PNG.sync.read(await fs.readFile(current));
  if(a.width!==b.width||a.height!==b.height){
    report.comparisons.push({file,status:'dimension-change',previous:{width:a.width,height:a.height},current:{width:b.width,height:b.height},ratio:1});
    severe=true;
    continue;
  }
  const diff=new PNG({width:a.width,height:a.height});
  const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0.15,includeAA:false});
  const ratio=pixels/(a.width*a.height);
  const status=ratio>=report.failThreshold?'severe':ratio>=report.warningThreshold?'warning':'ok';
  if(status==='severe')severe=true;
  const diffFile='visual-diff-'+file;
  await fs.writeFile(path.join(currentDir,diffFile),PNG.sync.write(diff));
  report.comparisons.push({file,status,changedPixels:pixels,totalPixels:a.width*a.height,ratio:Number(ratio.toFixed(5)),diffFile});
}
report.severe=severe;
await fs.writeFile(reportFile,JSON.stringify(report,null,2));

const rows=report.comparisons.map(x=>`|${x.file}|${x.status}|${x.ratio==null?'—':(x.ratio*100).toFixed(2)+'%'}|`).join('\n');
const summary=['## CallerCore visual drift','',report.available?'Compared key screenshots with the previous successful Preview QA run.':'No previous compatible baseline was available.','', '| Screenshot | Status | Changed pixels |','|---|---:|---:|',rows||'| — | — | — |'].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');

if(severe&&process.env.VISUAL_DRIFT_STRICT==='1'){
  throw new Error('Severe visual drift exceeded '+Math.round(report.failThreshold*100)+'% on at least one key screenshot.');
}
