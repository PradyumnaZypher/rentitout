import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { booking_id, amount, reason } = await req.json()
    if (!booking_id || !amount) {
      throw new Error('Missing booking_id or amount')
    }

    if (Deno.env.get('RAZORPAY_ENVIRONMENT') !== 'sandbox') {
      throw new Error('Refunds are only supported in Sandbox mode currently')
    }

    // Call server eligibility RPC
    const { data: eligibility, error: eligError } = await supabaseClient.rpc('get_refund_eligibility', { p_booking_id: booking_id })
    
    if (eligError || !eligibility || !eligibility.eligible) {
      throw new Error(eligibility?.reason || 'Not eligible for refund')
    }

    if (amount > eligibility.maximum_refundable_amount) {
      throw new Error(`Refund amount exceeds maximum refundable amount of ${eligibility.maximum_refundable_amount}`)
    }

    const payment_id = eligibility.payment_id
    const provider_payment_id = eligibility.provider_payment_id

    // Insert refund_request row
    const { data: refundReq, error: insertError } = await supabaseClient
      .from('refund_requests')
      .insert({
        booking_id,
        payment_id,
        requested_by: user.id,
        amount,
        reason,
        status: 'REQUESTED'
      })
      .select()
      .single()

    if (insertError) throw new Error('Failed to create refund request: ' + insertError.message)

    // Call Razorpay API
    const authString = btoa(`${Deno.env.get('RAZORPAY_KEY_ID')}:${Deno.env.get('RAZORPAY_KEY_SECRET')}`)
    
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${provider_payment_id}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        notes: {
          booking_id,
          refund_request_id: refundReq.id
        }
      })
    })

    const rzpData = await rzpRes.json()

    if (!rzpRes.ok) {
      // Mark as failed
      await supabaseClient
        .from('refund_requests')
        .update({ status: 'FAILED' })
        .eq('id', refundReq.id)
      throw new Error(rzpData.error?.description || 'Provider failed to process refund')
    }

    // Mark as processing/processed based on provider status
    const newStatus = rzpData.status === 'processed' ? 'PROCESSED' : 'PROCESSING'
    
    await supabaseClient
      .from('refund_requests')
      .update({ 
        status: newStatus,
        provider_refund_id: rzpData.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', refundReq.id)

    // Insert Ledger event
    await supabaseClient
      .from('financial_ledger')
      .insert({
        booking_id,
        event_type: newStatus === 'PROCESSED' ? 'REFUND_SUCCESS' : 'REFUND_PROCESSING',
        amount: amount,
        description: `Refund ${newStatus}`,
        metadata: {
          refund_request_id: refundReq.id,
          provider_refund_id: rzpData.id
        }
      })

    return new Response(JSON.stringify({ success: true, refund: rzpData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
