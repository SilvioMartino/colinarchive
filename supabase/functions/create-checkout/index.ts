import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { name, email, topic, details } = await req.json()

  const res = await fetch(`${supabaseUrl}/rest/v1/commissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ name, email, topic, details, amount: 100, status: 'pending' })
  })
  const [commission] = await res.json()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Post commission: ${topic}` },
        unit_amount: 700,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `https://colinarchive.onrender.com/success.html`,
    cancel_url: `https://colinarchive.onrender.com/index.html`,
    metadata: { commission_id: commission.id }
  })

  await fetch(`${supabaseUrl}/rest/v1/commissions?id=eq.${commission.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ stripe_session_id: session.id })
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
