import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id is required')

    // 1. Authenticate user & verify booking using the RPC
    const { data: bookingData, error: rpcError } = await supabaseClient
      .rpc('get_booking_for_payment', { p_booking_id: booking_id })

    if (rpcError || !bookingData) {
      throw new Error(rpcError?.message || 'Invalid booking or unauthorized')
    }

    const { amount, user_id } = bookingData

    // 2. Call Razorpay API to create order (amount is in paise)
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured')
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)
    
    // Amount in paise
    const amountInPaise = Math.round(amount * 100)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${booking_id.substring(0,8)}`,
      })
    })

    if (!orderRes.ok) {
      const errorText = await orderRes.text()
      console.error('Razorpay API error:', errorText)
      throw new Error('Failed to create Razorpay order')
    }

    const orderData = await orderRes.json()

    // 3. Insert payment record locally with service role
    const { data: payment, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id,
        user_id,
        amount,
        status: 'CREATED',
        provider_order_id: orderData.id
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert payment error:', insertError)
      throw new Error('Failed to save payment record')
    }

    // 4. Return safe checkout information to frontend
    return new Response(
      JSON.stringify({
        order_id: orderData.id,
        amount: amountInPaise,
        currency: 'INR',
        key_id: razorpayKeyId,
        payment_record_id: payment.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
