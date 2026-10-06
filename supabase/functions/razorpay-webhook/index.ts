import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signatureHeader = req.headers.get('x-razorpay-signature')
    if (!signatureHeader) {
      throw new Error('Missing webhook signature')
    }

    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured')
    }

    // Must read raw body for signature verification
    const rawBody = await req.text()

    // 1. Webhook Signature Verification
    const generatedSignature = hmac(
      'sha256',
      webhookSecret,
      rawBody,
      'utf8',
      'hex'
    )

    if (generatedSignature !== signatureHeader) {
      console.error('Webhook signature mismatch', { expected: generatedSignature, received: signatureHeader })
      throw new Error('Invalid webhook signature')
    }

    const event = JSON.parse(rawBody)

    // Only process relevant events
    const supportedEvents = [
      'payment.captured', 'order.paid', 
      'refund.processed', 'refund.failed',
      'transfer.reversed'
    ]
    if (!supportedEvents.includes(event.event)) {
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle refund events
    if (event.event === 'refund.processed' || event.event === 'refund.failed') {
      const refundObj = event.payload.refund?.entity
      if (refundObj) {
        const status = event.event === 'refund.processed' ? 'PROCESSED' : 'FAILED'
        const refundId = refundObj.id
        
        // Update refund status
        const { data: refundRec } = await supabaseAdmin
          .from('refund_requests')
          .update({ 
            status, 
            provider_refund_id: refundId,
            processed_at: new Date().toISOString()
          })
          .eq('provider_refund_id', refundId)
          .or(`provider_refund_id.is.null,id.eq.${refundObj.notes?.refund_request_id}`)
          .select()
          .single()

        // Insert ledger event if processed
        if (refundRec && status === 'PROCESSED') {
          // Check if already in ledger
          const { data: existingLedger } = await supabaseAdmin
            .from('financial_ledger')
            .select('id')
            .eq('booking_id', refundRec.booking_id)
            .eq('event_type', 'REFUND_SUCCESS')
            .contains('metadata', { provider_refund_id: refundId })
            .single()

          if (!existingLedger) {
            await supabaseAdmin.from('financial_ledger').insert({
              booking_id: refundRec.booking_id,
              event_type: 'REFUND_SUCCESS',
              amount: refundRec.amount,
              description: 'Refund Processed via Webhook',
              metadata: { provider_refund_id: refundId, refund_request_id: refundRec.id }
            })
          }
        }
      }
      return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Handle transfer reversal events
    if (event.event === 'transfer.reversed') {
      const transferObj = event.payload.transfer?.entity
      if (transferObj) {
        // Unfortunately, transfer.reversed doesn't give a specific reversal entity, just updates the transfer.
        // We will mark any PENDING reversal for this transfer as PROCESSED.
        const transferId = transferObj.id
        
        const { data: revRec } = await supabaseAdmin
          .from('transfer_reversals')
          .update({ 
            status: 'PROCESSED',
            processed_at: new Date().toISOString()
          })
          .eq('status', 'PROCESSING')
          .eq('provider_reversal_id', transferObj.reversal_id || 'unknown')
          .select()
          .single()
      }
      return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Safely locate order in database
    const payload = event.payload.payment?.entity || event.payload.order?.entity
    const providerOrderId = payload.order_id || payload.id
    
    if (!providerOrderId) {
      throw new Error('No order ID in payload')
    }


    const { data: paymentRecord, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('provider_order_id', providerOrderId)
      .single()

    if (fetchError || !paymentRecord) {
      console.error('Payment record not found for webhook:', providerOrderId)
      // Return 200 so Razorpay stops retrying if it's genuinely unknown
      return new Response(JSON.stringify({ status: 'unknown_order' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Idempotency check
    if (paymentRecord.status === 'PAID') {
      return new Response(JSON.stringify({ status: 'already_paid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const providerPaymentId = event.payload.payment?.entity?.id

    // 3. Update state using Service Role RPC
    const { error: rpcError } = await supabaseAdmin.rpc('mark_payment_paid', {
      p_payment_id: paymentRecord.id,
      p_provider_payment_id: providerPaymentId || 'webhook_captured',
      p_provider_order_id: providerOrderId
    })

    if (rpcError) {
      console.error('Webhook database update failed:', rpcError)
      throw new Error('Failed to update payment status via webhook')
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    // Always return 400 for bad signatures so Razorpay knows it failed
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})
