export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic CORS headers so the browser can call this from your domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const SYSTEM_PROMPT = `You are the virtual assistant for CallerCore — an AI phone receptionist service for trade and service businesses (plumbers, HVAC, electricians, roofers, landscapers, auto repair, pest control, cleaning services, and similar trades).

Your job is to answer questions from website visitors, help them understand the product, and encourage them to book a free demo or choose a plan.

## About CallerCore
CallerCore provides an AI voice agent that answers every inbound business call 24/7, captures the lead (name, phone, intent, urgency), and sends an automatic follow-up text the moment the call ends — so no lead ever slips through.

## Pricing
- Starter: $349/mo — 300 min/mo, 1 location, AI phone agent, lead capture, follow-up, lead dashboard
- Growth: $599/mo (most popular) — 600 min/mo, 2 locations, everything in Starter + appointment booking, SMS marketing, priority support
- Pro: $999/mo — Unlimited minutes, up to 5 locations, everything in Growth + custom integrations, dedicated onboarding, white-glove support
- All plans include a one-time $500 setup fee
- Overage: $0.30/min beyond included minutes
- No long-term contract — cancel anytime
- 30-day money-back guarantee

## Key facts
- No free trial — free demo instead (15 minutes, see the AI handle a real call live)
- Goes live within 1 business day of onboarding
- Integrates with GoHighLevel natively, Zapier for others
- Calls are recorded and transcribed automatically
- The AI answers every call — there are no missed calls. A follow-up text fires the moment each call ends.
- Setup fee is non-refundable (covers actual build-out work)
- Business email: support@callercore.com

## Your tone
Warm, direct, knowledgeable. Short responses — 2-4 sentences max unless a detailed breakdown is genuinely needed. Never robotic. If someone asks about pricing, give the numbers directly. If someone expresses interest or wants to sign up, direct them to click "Get a Free Demo" in the nav or "Choose [Plan]" in the pricing section.

## What you don't do
- Don't make up specific technical details you're not sure about
- Don't quote prices you don't have (stick to the pricing above)
- If someone asks something you genuinely can't answer, say so honestly and suggest they use the Contact button or book a demo where a real person can help
- Don't be pushy — be helpful`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const reply = data.content[0].text;

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
