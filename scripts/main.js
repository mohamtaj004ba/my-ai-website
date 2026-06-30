// System console animation
const logData = [
  {t:"09:14", badge:"in", badgeLabel:"IN", text:"Inbound contact received", small:"Routed to AI Agent", node:0, delay:2200},
  {t:"09:14", badge:"proc", badgeLabel:"AI", text:"AI responds: \"Thanks for reaching out — what do you need?\"", node:1, delay:2600},
  {t:"09:15", badge:"proc", badgeLabel:"AI", text:"Intent identified, urgency flagged", node:1, delay:2200},
  {t:"09:15", badge:"sys", badgeLabel:"CRM", text:"Lead logged — contact, intent, urgency saved", node:2, delay:2200},
  {t:"09:15", badge:"out", badgeLabel:"OUT", text:"Follow-up sent within 14 seconds", node:3, delay:2200},
  {t:"09:16", badge:"proc", badgeLabel:"AI", text:"Booking confirmed", small:"Zero manual entry", node:1, delay:2600},
];

function playConsole() {
  const feedBody = document.getElementById('feedBody');
  const nodeRow = document.getElementById('nodeRow');
  feedBody.innerHTML = '';
  if (nodeRow) {
    nodeRow.querySelectorAll('.node').forEach(n => n.classList.remove('lit'));
  }

  logData.forEach(log => {
    setTimeout(() => {
      // Highlight node
      if (nodeRow) {
        nodeRow.querySelectorAll('.node').forEach(n => n.classList.remove('lit'));
        const targetNode = nodeRow.querySelector(`[data-node="${log.node}"]`);
        if (targetNode) targetNode.classList.add('lit');
      }

      // Add log entry
      const clog = document.createElement('div');
      clog.className = 'clog';
      const badge = document.createElement('span');
      badge.className = `badge ${log.badge}`;
      badge.textContent = log.badgeLabel;
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = log.t;
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.innerHTML = log.text + (log.small ? `<small>${log.small}</small>` : '');
      clog.appendChild(t);
      clog.appendChild(badge);
      clog.appendChild(txt);
      feedBody.appendChild(clog);
    }, log.delay);
  });
}

// Initial play
playConsole();

// Replay button
const replayBtn = document.getElementById('consoleReplay');
if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    playConsole();
  });
}

// Counter animation
function animateCounter(el, start, end, duration, suffix = '', prefix = '') {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  const interval = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(interval);
    }
    el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
  }, 16);
}

// Intersection Observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      
      // Animate counters when element comes into view
      if (entry.target.classList.contains('stat-num')) {
        const count = parseInt(entry.target.dataset.count);
        const suffix = entry.target.dataset.suffix || '';
        const prefix = entry.target.dataset.prefix || '';
        animateCounter(entry.target, 0, count, 800, suffix, prefix);
      }
      if (entry.target.classList.contains('ns-num')) {
        const count = parseInt(entry.target.dataset.count);
        const suffix = entry.target.dataset.suffix || '';
        const prefix = entry.target.dataset.prefix || '';
        animateCounter(entry.target, 0, count, 800, suffix, prefix);
      }
      if (entry.target.classList.contains('dash-stat-num')) {
        const count = parseInt(entry.target.dataset.count);
        const suffix = entry.target.dataset.suffix || '';
        const prefix = entry.target.dataset.prefix || '';
        animateCounter(entry.target, 0, count, 800, suffix, prefix);
      }
      
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));

// Form handling
const form = document.getElementById('cta-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formNote = document.getElementById('formNote');
    if (formNote) {
      formNote.textContent = 'Thank you! We\'ll be in touch soon.';
      formNote.style.color = '#3FA66B';
    }
    form.reset();
    setTimeout(() => {
      if (formNote) {
        formNote.textContent = 'We\'ll get back to you within one business day.';
        formNote.style.color = '';
      }
    }, 3000);
  });
}
