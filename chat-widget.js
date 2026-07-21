// CallerCore chat widget — self-contained, drops into any page with one script tag.
// Injects markup on DOMContentLoaded, wires up the /api/chat backend and the GHL handoff.
(function(){
  if (window.__ccChatMounted) return; // guard against double-inject
  window.__ccChatMounted = true;

  const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/8m3nfjxNnGqagYU2ouAE/webhook-trigger/39d0fd5f-8ad9-478a-9294-8b7c97b61d9c';
  const WELCOME_MESSAGE = "Hi! I'm your virtual assistant. Ask me about pricing, how it works, or what businesses we support — and if I can't answer, I'll get you connected with the team.";

  const MARKUP = `
<button class="chat-bubble" id="chatBubble" aria-label="Open chat">
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="chatIconOpen">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="chatIconClose" style="display:none;">
    <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
  <span class="chat-bubble-dot"></span>
</button>
<div class="chat-panel" id="chatPanel">
  <div class="chat-header">
    <div class="chat-header-info">
      <span class="chat-header-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="#D2673C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      </span>
      <div>
        <div class="chat-header-title">Virtual Assistant</div>
        <div class="chat-header-status"><span class="chat-status-dot"></span>Online</div>
      </div>
    </div>
    <div class="chat-header-actions">
      <button class="chat-icon-btn" id="chatMinimizeBtn" aria-label="Minimize chat" title="Minimize">─</button>
      <button class="chat-icon-btn chat-end-text-btn" id="chatEndBtn" aria-label="End chat" title="End chat">End Chat</button>
    </div>
  </div>
  <div class="chat-body" id="chatBody">
    <div class="chat-messages" id="chatMessages">
      <div class="chat-msg chat-msg-bot">${WELCOME_MESSAGE}</div>
    </div>
    <div class="chat-quick-replies" id="chatQuickReplies">
      <button class="chat-quick-btn" data-q="How much does it cost?">Pricing</button>
      <button class="chat-quick-btn" data-q="How does it work?">How it works</button>
      <button class="chat-quick-btn" data-q="What businesses do you support?">Who it's for</button>
    </div>
    <div class="chat-handoff" id="chatHandoff" style="display:none;">
      <div class="chat-handoff-text">Leave your details and the question below — we'll follow up within one business day.</div>
      <form class="chat-handoff-form" id="chatHandoffForm">
        <input type="text" name="name" placeholder="Your name" required>
        <input type="text" name="contact" placeholder="Email or phone" required>
        <textarea name="question" placeholder="Your question..." rows="2"></textarea>
        <div class="chat-handoff-actions">
          <button type="button" class="chat-handoff-cancel" id="chatHandoffCancel">Cancel</button>
          <button type="submit" class="chat-handoff-submit">Send to team</button>
        </div>
        <div class="chat-handoff-note" id="chatHandoffNote"></div>
      </form>
    </div>
  </div>
  <form class="chat-input-row" id="chatInputForm">
    <input type="text" id="chatInput" placeholder="Type your question..." autocomplete="off">
    <button type="submit" class="chat-send-btn" aria-label="Send message">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </button>
  </form>
</div>`.trim();

  function init(){
    // Inject markup
    const container = document.createElement('div');
    container.innerHTML = MARKUP;
    while (container.firstChild) document.body.appendChild(container.firstChild);

    const chatBubble       = document.getElementById('chatBubble');
    const chatPanel        = document.getElementById('chatPanel');
    const chatIconOpen     = document.getElementById('chatIconOpen');
    const chatIconClose    = document.getElementById('chatIconClose');
    const chatMinimizeBtn  = document.getElementById('chatMinimizeBtn');
    const chatEndBtn       = document.getElementById('chatEndBtn');
    const chatMessages     = document.getElementById('chatMessages');
    const chatBody         = document.getElementById('chatBody');
    const chatInputForm    = document.getElementById('chatInputForm');
    const chatInput        = document.getElementById('chatInput');
    const chatQuickReplies = document.getElementById('chatQuickReplies');
    const chatHandoff      = document.getElementById('chatHandoff');
    const chatHandoffForm  = document.getElementById('chatHandoffForm');
    const chatHandoffCancel= document.getElementById('chatHandoffCancel');
    const chatHandoffNote  = document.getElementById('chatHandoffNote');

    const chatHistory = [];
    let lastUnansweredQuestion = '';

    async function sendLeadToGHL(payload){
      const fullPayload = Object.assign({
        page: window.location.href,
        timestamp: new Date().toISOString()
      }, payload);
      try {
        await fetch(GHL_WEBHOOK_URL, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(fullPayload)
        });
        return true;
      } catch(err){
        console.error('Failed to send lead to GHL:', err, fullPayload);
        return false;
      }
    }

    async function callClaudeAPI(userMessage){
      chatHistory.push({ role:'user', content:userMessage });
      const response = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ messages: chatHistory })
      });
      if (!response.ok) throw new Error('API error ' + response.status);
      const data = await response.json();
      chatHistory.push({ role:'assistant', content:data.reply });
      return data.reply;
    }

    function toggleChat(forceOpen){
      const isOpen = chatPanel.classList.contains('open');
      const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;
      chatPanel.classList.remove('minimized');
      chatPanel.classList.toggle('open', shouldOpen);
      chatIconOpen.style.display  = shouldOpen ? 'none'  : 'block';
      chatIconClose.style.display = shouldOpen ? 'block' : 'none';
      if (shouldOpen) setTimeout(() => chatInput.focus(), 250);
    }

    function resetChat(){
      chatMessages.innerHTML = '';
      chatHistory.length = 0;
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-bot';
      el.textContent = WELCOME_MESSAGE;
      chatMessages.appendChild(el);
      chatHandoff.style.display = 'none';
      chatHandoffNote.textContent = '';
      chatHandoffForm.reset();
      chatHandoffForm.querySelectorAll('input, textarea, button').forEach(el => el.disabled = false);
      chatQuickReplies.style.display = 'flex';
      chatInputForm.style.display = 'flex';
      chatInput.value = '';
    }

    function addMessage(text, sender){
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-' + sender;
      el.textContent = text;
      chatMessages.appendChild(el);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function showHandoffPrompt(question){
      lastUnansweredQuestion = question;
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-bot';
      el.textContent = "I'm not totally sure on that one — want me to get someone from the team to follow up with a real answer?";
      chatMessages.appendChild(el);
      chatHandoff.style.display = 'block';
      chatHandoff.querySelector('textarea').value = question;
      chatQuickReplies.style.display = 'none';
      chatInputForm.style.display = 'none';
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    async function handleUserMessage(text){
      if (!text.trim()) return;
      addMessage(text, 'user');
      chatInput.value = '';
      chatQuickReplies.style.display = 'none';

      const typingEl = document.createElement('div');
      typingEl.className = 'chat-msg chat-msg-bot chat-typing';
      typingEl.innerHTML = '<span></span><span></span><span></span>';
      chatMessages.appendChild(typingEl);
      chatBody.scrollTop = chatBody.scrollHeight;

      try {
        const reply = await callClaudeAPI(text);
        typingEl.remove();
        addMessage(reply, 'bot');
      } catch(err) {
        typingEl.remove();
        addMessage("Sorry, I'm having trouble connecting right now — but I don't want to leave you hanging.", 'bot');
        console.error('Claude API error:', err);
        showHandoffPrompt(text);
      }
    }

    // Wire up
    chatBubble.addEventListener('click', () => toggleChat());
    chatMinimizeBtn.addEventListener('click', () => chatPanel.classList.toggle('minimized'));
    chatEndBtn.addEventListener('click', () => { resetChat(); toggleChat(false); });

    chatInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserMessage(chatInput.value);
    });

    chatQuickReplies.querySelectorAll('.chat-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUserMessage(btn.dataset.q));
    });

    chatHandoffCancel.addEventListener('click', () => {
      chatHandoff.style.display = 'none';
      chatQuickReplies.style.display = 'flex';
      chatInputForm.style.display = 'flex';
      addMessage("Sure — go ahead and ask me anything else.", 'bot');
    });

    chatHandoffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(chatHandoffForm);
      const contactVal = (formData.get('contact') || '').trim();
      const payload = {
        name: formData.get('name'),
        email: contactVal.includes('@') ? contactVal : '',
        phone: contactVal.includes('@') ? '' : contactVal,
        message: lastUnansweredQuestion,
        question: lastUnansweredQuestion,
        source: 'chatbot'
      };
      chatHandoffForm.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
      const success = await sendLeadToGHL(payload);
      if (success) {
        chatHandoffNote.textContent = "Got it — we'll follow up within one business day.";
        chatHandoffNote.style.color = '#2E9E5B';
      } else {
        chatHandoffNote.textContent = "Something went wrong sending that — please try the contact form above instead.";
        chatHandoffNote.style.color = '#D2673C';
        chatHandoffForm.querySelectorAll('input, textarea, button').forEach(el => el.disabled = false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
