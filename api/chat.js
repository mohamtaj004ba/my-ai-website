const https = require('https');
const {rateLimit,requestIp}=require('../lib/rate-limit');
const {safeError,upstreamCode}=require('../lib/safe-log');

const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
function isAllowedOrigin(req) {
  const candidate = req.headers.origin || req.headers.referer || '';
  if (!candidate) return false;
  try {
    const host=new URL(candidate).host.toLowerCase();
    const requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
    return ALLOWED_HOSTS.has(host)||(host.endsWith('.vercel.app')&&host===requestHost);
  } catch (_) { return false; }
}
function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) return null;
  let total = 0;
  const safe = [];
  for (const m of messages) {
    if (!m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, 3000);
    total += content.length;
    if (!content || total > 18000) return null;
    safe.push({ role: m.role, content });
  }
  return safe;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(req)) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Cache-Control', 'no-store');
  const rl=await rateLimit({scope:'public-chat',identifier:requestIp(req),limit:25,windowSeconds:600,failClosed:true});if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({ error: 'Too many requests' })}
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Assistant unavailable' });

  const safeMessages = sanitizeMessages(req.body && req.body.messages);
  if (!safeMessages) return res.status(400).json({ error: 'Invalid request body' });

  const SYSTEM_PROMPT = `You are the virtual assistant for CallerCore, an AI phone receptionist service for trade and service businesses — plumbers, HVAC, electricians, roofers, landscapers, auto repair, pest control, cleaning services, and similar trades.

Your job is to answer visitors' questions clearly, help them understand the product, and — when it fits naturally — invite them to explore the demo page or choose a plan. Help first; there is no scheduled demo booking.

HOW TO WRITE (very important):
- Reply in plain, conversational text, like a friendly, knowledgeable person texting. Never use Markdown formatting: no asterisks for bold, no pound signs for headers, no numbered or bulleted lists. Write in natural sentences.
- Keep replies short. Two or three sentences is usually plenty. Answer the question, then stop. Don't dump everything you know at once.
- Use contractions and a warm, easy tone (you're, it'll, that's). Match the visitor's energy — a short question gets a short answer.
- If you'd naturally list a few things, fold them into a sentence instead. Say "it answers your calls, grabs the caller's details, and gives the team a clear summary" rather than a numbered list.
- End with one clear next step at most, not a menu of options.

HOW TO BEHAVE:
- Answer the actual question first. Don't deflect everything to "book a demo" — that feels pushy and kills trust. Help, then invite.
- Be honest. If you don't know something specific, or a visitor asks something you genuinely can't answer, say so plainly and point them to the Contact button or a demo where a real person can help. Never guess or make things up.
- Don't promise a setup deadline. Payment starts setup, not live answering. Business details, number routing and receptionist configuration must be reviewed and tested before activation; support can confirm timing for a particular business.
- Never pretend to be a human. If asked, say you're CallerCore's virtual assistant, here to help.
- Stay on topic. If someone goes off-topic, gently steer back to how CallerCore can help their business.
- Never invent prices or technical details, never use fake urgency, and never give medical, legal, or financial advice.

ABOUT CALLERCORE:
CallerCore is an AI voice agent designed to answer inbound business calls 24/7, capture the lead (name, phone, what they need, and how urgent it is), and give the business a clear record for follow-up. Call records, transcripts or summaries can appear in the dashboard when the configured voice setup supports them. Do not promise SMS, calendar booking, or any integration unless it is explicitly enabled for that customer.

PRICING (share naturally in conversation, not as a list unless they ask for the full breakdown):
- Starter is 349 dollars a month: 300 minutes, 1 location, the AI phone agent, lead capture, follow-up, and the lead dashboard.
- Growth is 599 a month: 600 minutes, up to 2 locations, everything in Starter plus advanced lead qualification, business-specific intake questions, and priority routing and escalation. Do not describe SMS or calendar booking as included until those integrations are launched.
- Pro is 999 a month: up to 5 locations, everything in Growth plus custom call workflows, multi-team routing and advanced integrations. Integration availability depends on supported, configured tools. If asked about Pro usage limits or fair-use terms, direct them to support@callercore.com until the policy is finalized.
- Every plan has a one-time 500 dollar setup fee, usage beyond included minutes is handled according to the billing terms disclosed at signup, and there's no long-term contract — cancel anytime.

KEY FACTS:
- There is no free trial. The demo page checks whether a phone demo number is available when requested. You cannot verify its current availability from this chat; never claim the line is active or give an invented number. The homepage also offers an illustrative text walkthrough.
- There's a 30-day money-back guarantee on the monthly plan. The one-time setup fee is non-refundable, since it covers the actual build-out work.
- Live answering requires completed setup, testing and verified activation. A saved configuration or successful payment alone does not mean calls are being answered.
- Integrations are configured around the client's workflow and supported tools.
- For anything the team needs to handle directly, the email is support@callercore.com.

WHERE TO POINT PEOPLE:
- Wants to hear it work → "Try the AI" in the nav takes them to the demo page to check availability and reveal a number if available.
- Ready to sign up → "Get CallerCore" in the nav (top right) takes them to plan selection and Stripe checkout.
- Has a question you can't fully answer → point them to "Talk to us" in the nav so a real person can follow up. Also fine to use the handoff form inside this chat.
- There is no calendar or scheduled call to book — the demo is self-serve by phone, and anything else routes through the contact form.`;

  const body = JSON.stringify({
    model: 'gpt-5.4-mini-2026-03-17',
    max_output_tokens: 1000,
    store:false, instructions: SYSTEM_PROMPT,
    input: safeMessages
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/responses',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Bearer '+process.env.OPENAI_API_KEY
    }
  };

  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          if (apiRes.statusCode !== 200) {
            console.error('OpenAI API error:', upstreamCode(data));
            res.status(502).json({ error: 'Upstream API error' });
            return resolve();
          }
          const parsed = JSON.parse(data);
          if(parsed?.status!=='completed'||parsed?.error)throw new Error('OpenAI chat response was not completed');
          if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.output))
            throw new Error('OpenAI chat response could not be verified');
          const reply = String(parsed.output.flatMap(item=>Array.isArray(item?.content)?item.content:[]).find(item=>item&&item.type==='output_text'&&typeof item.text==='string')?.text||'').trim();
          if(!reply)throw new Error('OpenAI chat response did not contain verified text');
          res.status(200).json({ reply });
          resolve();
        } catch (err) {
          console.error('OpenAI response validation failed:', safeError(err));
          res.status(502).json({ error: 'Assistant response unavailable' });
          resolve();
        }
      });
    });
    apiReq.on('error', (err) => {
      console.error('Request error:', safeError(err));
      res.status(500).json({ error: 'Request failed' });
      resolve();
    });
    apiReq.setTimeout?.(20000,()=>apiReq.destroy(new Error('Assistant timeout')));
    apiReq.write(body);
    apiReq.end();
  });
};
