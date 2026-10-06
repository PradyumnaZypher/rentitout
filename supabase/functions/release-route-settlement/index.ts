import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const environment = Deno.env.get('RAZORPAY_ENVIRONMENT')
    if (environment !== 'sandbox') {
      throw new Error('Sandbox configuration is missing or invalid. Action disabled.')
    }

    const { transfer_id } = await req.json()
    if (!transfer_id) throw new Error('transfer_id is required')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Authenticate caller (Must be admin, or at least authorized. For this scope, we require admin role)
    const { data: user } = await supabaseClient.auth.getUser()
    if (!user?.user) throw new Error('Unauthorized')

    // 2. Fetch transfer from DB
    const { data: transfer, error: transferError } = await supabaseAdmin
      .from('route_transfers')
      .select('*')
      .eq('id', transfer_id)
      .single()

    if (transferError || !transfer) {
      throw new Error('Transfer not found')
    }

    // Only allow releasing holds if it's currently on hold
    if (!transfer.on_hold || transfer.settlement_status === 'SETTLED') {
      throw new Error('Transfer is not on hold')
    }

    // Check if the user is the owner (in future it should be Admin only, but for Sandbox we can let owner release)
    if (transfer.owner_id !== user.user.id) {
       throw new Error('Unauthorized to release this settlement')
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials missing')
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    // 3. Patch transfer to release hold
    const patchRes = await fetch(`https://api.razorpay.com/v1/transfers/${transfer.provider_transfer_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        on_hold: 0
      })
    })

    if (!patchRes.ok) {
      const errorText = await patchRes.text()
      console.error('Razorpay API error:', errorText)
      throw new Error('Failed to release Razorpay Route hold')
    }

    // 4. Update local state
    const { error: updateError } = await supabaseAdmin
      .from('route_transfers')
      .update({
        on_hold: false,
        settlement_status: 'RELEASE_REQUESTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', transfer.id)

    if (updateError) {
      throw new Error('Database error updating settlement status')
    }

    // 5. Append Ledger Event
    await supabaseAdmin.from('financial_ledger').insert({
      booking_id: transfer.booking_id,
      payment_id: transfer.payment_id,
      owner_id: transfer.owner_id,
      event_type: 'SETTLEMENT_RELEASE_REQUESTED',
      amount: transfer.owner_amount,
      currency: transfer.currency,
      description: 'Route transfer hold release requested'
    })

    return new Response(JSON.stringify({ success: true, status: 'RELEASE_REQUESTED' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})
