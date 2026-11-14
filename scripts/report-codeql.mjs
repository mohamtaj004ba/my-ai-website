import fs from 'node:fs';
import path from 'node:path';

const directory=process.argv[2];
if(!directory||!fs.existsSync(directory)){
  console.error('CodeQL SARIF directory is unavailable; findings cannot be summarized.');
  process.exitCode=1;
}else{
  const files=fs.readdirSync(directory).filter(name=>name.endsWith('.sarif'));
  if(!files.length){
    console.error('No CodeQL SARIF files found; do not treat this as zero security findings.');
    process.exitCode=1;
  }else{
    const lines=['CodeQL SARIF diagnostic report (all scan results, not just new PR alerts):'];
    let total=0;
    for(const file of files){
      const data=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
      for(const run of data.runs||[]){
        const rules=run.tool?.driver?.rules||[];
        for(const result of run.results||[]){
          total++;
          const rule=rules.find(r=>r.id===result.ruleId)||rules[result.ruleIndex]||{};
          const id=String(result.ruleId||rule.id||'unknown').slice(0,140);
          const severity=String(rule.properties?.['security-severity']||result.properties?.['security-severity']||result.level||'unknown').slice(0,24);
          const title=String(rule.shortDescription?.text||rule.name||'').replace(/[\r\n|]/g,' ').slice(0,120);
          const location=result.locations?.[0]?.physicalLocation||{};
          const filePath=String(location.artifactLocation?.uri||'(unlocated)').replace(/[\r\n|]/g,' ').slice(0,240);
          const line=Number(location.region?.startLine)||'?';
          lines.push(id+' [security severity '+severity+'] '+filePath+':'+line+(title?' — '+title:''));
        }
      }
    }
    lines.push('Total SARIF results: '+total+'. GitHub separately determines which are new PR alerts.');
    const output=lines.slice(0,102).join('\n');
    console.log(output);
    if(lines.length>102)console.log('Additional results omitted from log; see GitHub Code Scanning.');
    if(process.env.GITHUB_STEP_SUMMARY){
      const escaped=lines.slice(0,102).map(line=>line.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### CodeQL finding locations\n\n'+escaped.map(line=>'- '+line).join('\n')+'\n');
    }
  }
}
