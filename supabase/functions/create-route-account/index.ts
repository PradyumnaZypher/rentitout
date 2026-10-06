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

    // 1. Authenticate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // 2. Load existing payout profile safely
    let { data: profile } = await supabaseAdmin
      .from('payout_profiles')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    // 3. Create Razorpay Route Linked Account
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured')
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    let accountId = profile?.provider_account_id

    if (!accountId) {
      // Fetch public profile for basic details
      const { data: publicProfile } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      // Sandbox API call to create Route Account
      const accountRes = await fetch('https://api.razorpay.com/beta/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        },
        body: JSON.stringify({
          name: publicProfile?.name || 'Rentitout Owner',
          email: user.email,
          tnc_accepted: true,
          type: 'route'
        })
      })

      if (!accountRes.ok) {
        const errorText = await accountRes.text()
        console.error('Razorpay Account API error:', errorText)
        throw new Error('Failed to create provider account')
      }

      const accountData = await accountRes.json()
      accountId = accountData.id

      // Upsert the payout profile with the new provider account ID
      const { error: upsertError } = await supabaseAdmin
        .from('payout_profiles')
        .upsert({
          owner_id: user.id,
          provider_account_id: accountId,
          kyc_status: 'CREATED'
        })

      if (upsertError) {
        console.error('Failed to save payout profile:', upsertError)
        throw new Error('Database error')
      }
    }

    // Generate Hosted Onboarding link
    // Note: Since this is Sandbox, we return the link for the owner to complete KYC
    const productSetupRes = await fetch(`https://api.razorpay.com/beta/accounts/${accountId}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        product_name: "route",
        tnc_accepted: true
      })
    })
    
    // Ignore error if already requested
    if (!productSetupRes.ok && productSetupRes.status !== 400) {
       console.error('Failed to setup product', await productSetupRes.text())
    }

    // In a real application, we would call the Hosted Onboarding API here
    // Currently simulating the response
    return new Response(
      JSON.stringify({
        provider_account_id: accountId,
        status: 'CREATED',
        message: 'Sandbox onboarding initiated successfully.'
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
