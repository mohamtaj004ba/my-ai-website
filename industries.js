const strip=document.querySelector('.industry-proof'),motion=strip?.querySelector('.industry-motion');
motion?.addEventListener('click',()=>{const paused=strip.classList.toggle('paused');motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'Resume industry rotation':'Pause industry rotation');motion.textContent=paused?'▶':'Ⅱ';});
