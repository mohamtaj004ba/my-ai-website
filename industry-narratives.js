/* Every scenario remains readable if JavaScript is unavailable. */
document.querySelectorAll('[data-scenario-selector]').forEach(selector=>{
 const buttons=[...selector.querySelectorAll('[data-scenario]')];
 const panels=[...selector.querySelectorAll('.scenario-panel')];
 function select(button){
  buttons.forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
  panels.forEach(panel=>{panel.hidden=panel.id!==button.getAttribute('aria-controls');});
 }
 buttons.forEach(button=>button.addEventListener('click',()=>select(button)));
 select(buttons[0]);
});
