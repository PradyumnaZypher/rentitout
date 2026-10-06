import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Sandbox Environment Check
    const environment = Deno.env.get('RAZORPAY_ENVIRONMENT')
    if (environment !== 'sandbox') {
      throw new Error('Sandbox configuration is missing or invalid. Transfers disabled.')
    }

    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id is required')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Determine Eligibility using Postgres RPC
    const { data: eligibility, error: eligibilityError } = await supabaseClient.rpc(
      'get_transfer_eligibility',
      { p_booking_id: booking_id }
    )

    if (eligibilityError || !eligibility?.is_eligible) {
      throw new Error(eligibilityError?.message || 'Booking not eligible for transfer')
    }

    const {
      payment_id,
      provider_payment_id,
      provider_account_id,
      gross_amount,
      commission,
      owner_amount
    } = eligibility

    // 3. Setup Razorpay call
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials missing')
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    // 4. Create Transfer (Razorpay API requires amount in paise)
    // NOTE: the DB amount is already in paise (integer)
    const transferRes = await fetch(`https://api.razorpay.com/v1/payments/${provider_payment_id}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        transfers: [
          {
            account: provider_account_id,
            amount: owner_amount,
            currency: 'INR',
            notes: {
              booking_id: booking_id
            },
            on_hold: true
          }
        ]
      })
    })

    if (!transferRes.ok) {
      const errorText = await transferRes.text()
      console.error('Razorpay API error:', errorText)
      throw new Error('Failed to create Razorpay Route transfer')
    }

    const transferData = await transferRes.json()
    const providerTransferId = transferData.items[0].id

    // 5. Store record in DB
    const { data: user } = await supabaseClient.auth.getUser()
    
    const { error: recordError } = await supabaseAdmin.rpc('record_route_transfer', {
      p_booking_id: booking_id,
      p_payment_id: payment_id,
      p_owner_id: user?.user?.id,
      p_provider_transfer_id: providerTransferId,
      p_provider_account_id: provider_account_id,
      p_gross_amount: gross_amount,
      p_commission: commission,
      p_owner_amount: owner_amount,
      p_currency: 'INR'
    })

    if (recordError) {
      console.error('Failed to record transfer:', recordError)
      throw new Error('Database error recording transfer')
    }

    return new Response(JSON.stringify({ 
      success: true, 
      transfer_id: providerTransferId,
      status: 'ON_HOLD'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})
