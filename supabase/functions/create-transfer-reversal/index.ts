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
      throw new Error('Reversals are only supported in Sandbox mode currently')
    }

    // Must be admin to initiate reversals manually
    const { data: userData } = await supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!userData?.is_admin) {
        throw new Error('Only admins can initiate transfer reversals')
    }

    // Call server eligibility RPC
    const { data: eligibility, error: eligError } = await supabaseClient.rpc('get_transfer_reversal_eligibility', { p_booking_id: booking_id })
    
    if (eligError || !eligibility || !eligibility.eligible) {
      throw new Error(eligibility?.reason || 'Not eligible for reversal')
    }

    if (amount > eligibility.maximum_reversible_amount) {
      throw new Error(`Reversal amount exceeds maximum reversible amount of ${eligibility.maximum_reversible_amount}`)
    }

    const route_transfer_id = eligibility.route_transfer_id
    const provider_transfer_id = eligibility.provider_transfer_id

    // Insert transfer_reversals row
    const { data: revReq, error: insertError } = await supabaseClient
      .from('transfer_reversals')
      .insert({
        booking_id,
        route_transfer_id,
        requested_by: user.id,
        amount,
        reason,
        status: 'REQUESTED'
      })
      .select()
      .single()

    if (insertError) throw new Error('Failed to create reversal request: ' + insertError.message)

    // Call Razorpay API
    const authString = btoa(`${Deno.env.get('RAZORPAY_KEY_ID')}:${Deno.env.get('RAZORPAY_KEY_SECRET')}`)
    
    const rzpRes = await fetch(`https://api.razorpay.com/v1/transfers/${provider_transfer_id}/reversals`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        notes: {
          booking_id,
          reversal_request_id: revReq.id
        }
      })
    })

    const rzpData = await rzpRes.json()

    if (!rzpRes.ok) {
      // Mark as failed
      await supabaseClient
        .from('transfer_reversals')
        .update({ status: 'FAILED' })
        .eq('id', revReq.id)
      throw new Error(rzpData.error?.description || 'Provider failed to process reversal')
    }

    // Note: Reversals usually process immediately, but we map to processing just in case webhooks update it
    const newStatus = rzpData.id ? 'PROCESSED' : 'PROCESSING'
    
    await supabaseClient
      .from('transfer_reversals')
      .update({ 
        status: newStatus,
        provider_reversal_id: rzpData.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', revReq.id)

    // Insert Ledger event
    await supabaseClient
      .from('financial_ledger')
      .insert({
        booking_id,
        event_type: 'TRANSFER_REVERSED',
        amount: amount,
        description: `Transfer Reversed`,
        metadata: {
          reversal_request_id: revReq.id,
          provider_reversal_id: rzpData.id
        }
      })

    return new Response(JSON.stringify({ success: true, reversal: rzpData }), {
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
