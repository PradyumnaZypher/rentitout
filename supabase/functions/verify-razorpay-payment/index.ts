import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { payment_record_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    
    if (!payment_record_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing required verification parameters')
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured')
    }

    // 1. Cryptographic Signature Verification
    const generatedSignature = hmac(
      'sha256',
      razorpayKeySecret,
      `${razorpay_order_id}|${razorpay_payment_id}`,
      'utf8',
      'hex'
    )

    if (generatedSignature !== razorpay_signature) {
      console.error('Signature mismatch', { expected: generatedSignature, received: razorpay_signature })
      throw new Error('Invalid signature')
    }

    // 2. Mark payment as PAID safely using Service Role
    const { error: rpcError } = await supabaseAdmin.rpc('mark_payment_paid', {
      p_payment_id: payment_record_id,
      p_provider_payment_id: razorpay_payment_id,
      p_provider_order_id: razorpay_order_id
    })

    if (rpcError) {
      console.error('Failed to update payment status:', rpcError)
      throw new Error('Verification successful, but database update failed')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
