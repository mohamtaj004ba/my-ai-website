const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

for(const file of ['dashboard.html','admin-dashboard.html']){
  test(file+' top-level modals expose dialog semantics and accessible names',()=>{
    const html=fs.readFileSync(file,'utf8');
    const tags=[...html.matchAll(/<div class="modal" id="([^"]+)"[^>]*>/g)];
    assert.ok(tags.length>0);
    for(const match of tags){
      const tag=match[0];
      assert.match(tag,/role="dialog"/);
      assert.match(tag,/aria-modal="true"/);
      const labelled=tag.match(/aria-labelledby="([^"]+)"/);
      assert.ok(labelled&&labelled[1],match[1]+' must reference a title');
      assert.match(html,new RegExp('id="'+labelled[1]+'"'));
    }
  });
}
