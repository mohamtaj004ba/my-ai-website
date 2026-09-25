const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');

test('Conversations is exposed through the entitled client navigation',()=>{
  assert.match(html,/data-view="conversations" data-feature="unifiedInbox"/);
  assert.match(html,/id="view-conversations"/);
  assert.match(js,/if\(name==='conversations'\)renderConversations\(\)/);
  assert.match(js,/cg\.hidden=has\('unifiedInbox'\);ca\.hidden=!has\('unifiedInbox'\)/);
});

test('contact directory exposes scalable filters and progressive loading',()=>{
  assert.match(html,/id="contactTypeFilter"/);
  assert.match(html,/id="contactSort"/);
  assert.match(html,/id="contactListFooter"/);
  assert.match(html,/id="loadMoreContacts"/);
  assert.match(js,/contactVisibleLimit=50/);
  assert.match(js,/contactLastFilterSignature=''/);
  assert.match(js,/visibleRows=rows\.slice\(0,contactVisibleLimit\)/);
  assert.match(js,/contactVisibleLimit\+=50;renderContacts\(\)/);
  assert.match(js,/Showing '\+shown\+' of '\+totalRows\+' matching contact/);
});

test('contact directory supports type and recency/name sorting',()=>{
  assert.match(js,/typeFilter=document\.getElementById\('contactTypeFilter'\)/);
  assert.match(js,/sort=document\.getElementById\('contactSort'\)/);
  assert.match(js,/typeFilter==='all'\|\|kind===typeFilter/);
  assert.match(js,/sort==='name'\?String\(a\.name\|\|''\)\.localeCompare/);
  assert.match(css,/\.contact-toolbar\{/);
  assert.match(css,/\.contact-list-footer\{/);
});
