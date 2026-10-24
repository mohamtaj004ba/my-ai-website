'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {validSource,validImages}=require('../lib/agent-operations-qa');
async function loadEvidence(source,{directory=path.resolve(__dirname,'../artifacts/agent-operations')}={}){
 if(!validSource(source))throw new Error('Original evidence binding invalid');
 const root=await fs.realpath(directory),images=[];
 for(const a of source.inspect.artifacts){
  if(path.basename(a.path)!==a.path)throw new Error('Original evidence path invalid');
  const file=path.join(root,a.path),stat=await fs.lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2250000||await fs.realpath(file)!==file)throw new Error('Original evidence unavailable');
  images.push({...a,dataUrl:'data:image/png;base64,'+(await fs.readFile(file)).toString('base64')});
 }
 if(!validImages(images,source))throw new Error('Original evidence mismatch');
 return images;
}
module.exports={loadEvidence};
