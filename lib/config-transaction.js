// Compare every snapshot before writing any record. All arguments are prepared
// before EVAL so concurrent edits fail closed without rolling back newer data.
const CONFIG_COMPARE_AND_SET=`
for i = 1, #KEYS do
  local current = redis.call('GET', KEYS[i]) or ''
  if current ~= ARGV[(i - 1) * 2 + 1] then return 0 end
end
for i = 1, #KEYS do
  redis.call('SET', KEYS[i], ARGV[(i - 1) * 2 + 2])
end
return 1
`;
async function compareAndSetConfig(kv,updates){
  if(!updates.length)return true;
  if(new Set(updates.map(x=>x.key)).size!==updates.length)throw new Error('Duplicate configuration key');
  const args=updates.flatMap(x=>[x.before==null?'':JSON.stringify(x.before),JSON.stringify(x.after)]);
  return Number(await kv.eval(CONFIG_COMPARE_AND_SET,updates.map(x=>x.key),args))===1;
}
module.exports={compareAndSetConfig,CONFIG_COMPARE_AND_SET};
