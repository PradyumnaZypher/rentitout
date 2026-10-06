import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

    if (!signature || !secret) {
      throw new Error('Missing signature or secret')
    }

    // 1. Verify Webhook Signature using raw body
    const expectedSignature = hmac('sha256', secret, rawBody, 'utf8', 'hex')

    if (expectedSignature !== signature) {
      console.error('Webhook signature mismatch')
      throw new Error('Invalid signature')
    }

    const event = JSON.parse(rawBody)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Handle relevant Route webhook events
    const eventType = event.event
    const accountId = event.payload?.account?.entity?.id

    if (!accountId) {
      return new Response('OK', { status: 200 }) // Ignore events without account ID
    }

    let newStatus = ''
    
    // Status mapping for Phase 11
    if (eventType === 'product.route.under_review') {
      newStatus = 'UNDER_REVIEW'
    } else if (eventType === 'product.route.needs_clarification') {
      newStatus = 'NEEDS_CLARIFICATION'
    } else if (eventType === 'product.route.activated' || eventType === 'account.activated') {
      newStatus = 'ACTIVE'
    } else if (eventType === 'product.route.rejected') {
      newStatus = 'REJECTED'
    }

    if (newStatus) {
      // 3. Update internal payout profile status securely using RPC
      const { error: rpcError } = await supabaseAdmin.rpc('update_payout_profile_status', {
        p_provider_account_id: accountId,
        p_new_status: newStatus
      })

      if (rpcError) {
        console.error('Failed to update profile status:', rpcError)
        throw new Error('Database error')
      }

      // 4. Create internal notification for the owner
      const { data: profile } = await supabaseAdmin
        .from('payout_profiles')
        .select('owner_id')
        .eq('provider_account_id', accountId)
        .single()

      if (profile) {
        let notificationMsg = ''
        let title = ''

        if (newStatus === 'UNDER_REVIEW') {
          title = 'Payout Account Under Review'
          notificationMsg = 'Your payout account is under review.'
        } else if (newStatus === 'NEEDS_CLARIFICATION') {
          title = 'Payout Account Needs Clarification'
          notificationMsg = 'Additional information is required to complete your payout account setup.'
        } else if (newStatus === 'ACTIVE') {
          title = 'Payout Account Active'
          notificationMsg = 'Your payout account is now active.'
        }

        if (notificationMsg) {
          // Idempotency: We could check if a recent notification exists to avoid spamming
          await supabaseAdmin.rpc('create_notification', {
            p_user_id: profile.owner_id,
            p_type: 'SYSTEM',
            p_title: title,
            p_message: notificationMsg,
            p_link_type: 'payout',
            p_link_id: accountId
          })
        }
      }
    }

    // 5. Handle Transfer events
    const transferId = event.payload?.transfer?.entity?.id
    if (transferId && (eventType === 'transfer.processed' || eventType === 'transfer.failed' || eventType === 'transfer.reversed')) {
      let transferStatus = ''
      if (eventType === 'transfer.processed') transferStatus = 'PROCESSED'
      if (eventType === 'transfer.failed') transferStatus = 'FAILED'
      if (eventType === 'transfer.reversed') transferStatus = 'REVERSED'

      if (transferStatus) {
        const { error: transferRpcError } = await supabaseAdmin.rpc('update_route_transfer_status', {
          p_provider_transfer_id: transferId,
          p_new_status: transferStatus
        })

        if (transferRpcError) {
          console.error('Failed to update transfer status:', transferRpcError)
          throw new Error('Database error')
        }
      }
    }

    // 6. Handle Settlement events
    if (eventType === 'settlement.processed') {
      const settlementId = event.payload?.settlement?.entity?.id
      if (accountId && settlementId) {
        const { error: settlementRpcError } = await supabaseAdmin.rpc('update_transfers_settled_for_account', {
          p_provider_account_id: accountId,
          p_provider_settlement_id: settlementId
        })
        if (settlementRpcError) {
          console.error('Failed to update settled transfers:', settlementRpcError)
          throw new Error('Database error')
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
