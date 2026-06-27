import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { supabase, type Message, type Profile, getConversationId } from '@/lib/supabase'
import { timeAgo, cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/shared/EmptyState'

interface Conversation {
  id: string
  otherUser: Profile
  lastMessage: Message
  unreadCount: number
}

export default function Messages() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const withUserId = searchParams.get('with')
  const listingId = searchParams.get('listing')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (!user) return
    loadConversations()
  }, [user])

  useEffect(() => {
    if (withUserId && user) {
      const convId = getConversationId(user.id, withUserId)
      setActiveConvId(convId)
      loadConversation(convId, withUserId)
    }
  }, [withUserId, user])

  // Presence channel for typing indicators
  useEffect(() => {
    if (!activeConvId || !user) return

    const channel = supabase.channel(`room:${activeConvId}`, {
      config: { presence: { key: user.id } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        let someoneElseTyping = false
        for (const [key, presences] of Object.entries(state)) {
          if (key !== user.id) {
            // @ts-ignore
            if (presences.some((p) => p.typing)) someoneElseTyping = true
          }
        }
        setIsOtherTyping(someoneElseTyping)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ typing: false })
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [activeConvId, user])

  const loadConversations = async () => {
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(name,avatar_url), receiver:profiles!receiver_id(name,avatar_url)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    // Group by conversation
    const convMap = new Map<string, any>()
    for (const msg of data ?? []) {
      if (!convMap.has(msg.conversation_id)) {
        convMap.set(msg.conversation_id, msg)
      }
    }

    const convs: Conversation[] = []
    for (const [id, msg] of convMap) {
      const isMe = msg.sender_id === user.id
      const otherUserData = isMe ? msg.receiver : msg.sender
      convs.push({
        id,
        otherUser: otherUserData,
        lastMessage: msg,
        unreadCount: 0,
      })
    }
    setConversations(convs)
    setLoading(false)
  }

  const loadConversation = async (convId: string, otherUserId: string) => {
    const [{ data: msgs }, { data: otherProfile }] = await Promise.all([
      supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(name,avatar_url)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', otherUserId).maybeSingle(),
    ])
    setMessages((msgs as Message[]) ?? [])
    setOtherUser(otherProfile)
  }

  const selectConversation = async (conv: Conversation) => {
    setActiveConvId(conv.id)
    const otherId = conv.lastMessage.sender_id === user?.id
      ? conv.lastMessage.receiver_id
      : conv.lastMessage.sender_id
    await loadConversation(conv.id, otherId)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeConvId || !otherUser) return
    setSending(true)

    const receiverId = withUserId ?? (
      conversations.find((c) => c.id === activeConvId)?.lastMessage.sender_id === user.id
        ? conversations.find((c) => c.id === activeConvId)?.lastMessage.receiver_id
        : conversations.find((c) => c.id === activeConvId)?.lastMessage.sender_id
    )

    const { data, error } = await supabase.from('messages').insert({
      content: newMessage.trim(),
      sender_id: user.id,
      receiver_id: receiverId ?? otherUser.id,
      conversation_id: activeConvId,
      listing_id: listingId,
    }).select('*, sender:profiles!sender_id(name,avatar_url)').maybeSingle()

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message])
      setNewMessage('')
      
      // Stop typing
      setTyping(false)
      channelRef.current?.track({ typing: false })
      
      loadConversations()
    }
    setSending(false)
  }

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    if (channelRef.current) {
      if (!typing) {
        setTyping(true)
        channelRef.current.track({ typing: true })
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false)
        channelRef.current?.track({ typing: false })
      }, 2000)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <Spinner className="size-8" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-6">Messages</h1>

        <div className="bg-card rounded-2xl border border-border overflow-hidden" style={{ height: '70vh' }}>
          <div className="flex h-full">
            {/* Conversation list */}
            <div className="w-72 border-r border-border flex flex-col shrink-0 hidden sm:flex">
              <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-sm">Conversations</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 && !withUserId && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet</div>
                )}
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left',
                      activeConvId === conv.id && 'bg-[var(--brand-soft)] border-r-2 border-[var(--brand)]'
                    )}
                  >
                    <UserAvatar name={conv.otherUser?.name ?? 'U'} avatarUrl={conv.otherUser?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{conv.otherUser?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message area */}
            <div className="flex-1 flex flex-col min-w-0">
              {!activeConvId ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={<MessageSquare className="size-8 text-muted-foreground" />}
                    title="Select a conversation"
                    description="Choose a conversation from the left or start a new one from a listing."
                  />
                </div>
              ) : (
                <>
                  {/* Header */}
                  {otherUser && (
                    <div className="p-4 border-b border-border flex items-center gap-3">
                      <UserAvatar name={otherUser.name} avatarUrl={otherUser.avatar_url} size="sm" />
                      <div>
                        <p className="font-semibold text-sm">{otherUser.name}</p>
                        <p className="text-xs text-muted-foreground">{otherUser.city}</p>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id
                      return (
                        <div key={msg.id} className={cn('flex gap-2', isMe && 'flex-row-reverse')}>
                          {!isMe && (
                            <UserAvatar name={(msg as any).sender?.name ?? 'U'} avatarUrl={(msg as any).sender?.avatar_url} size="xs" />
                          )}
                          <div className={cn(
                            'max-w-xs px-3 py-2 rounded-2xl text-sm',
                            isMe ? 'bg-[var(--brand)] text-white rounded-br-sm' : 'bg-muted rounded-bl-sm'
                          )}>
                            <p>{msg.content}</p>
                            <p className={cn('text-xs mt-1', isMe ? 'text-white/60' : 'text-muted-foreground')}>
                              {timeAgo(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Typing Indicator */}
                    {isOtherTyping && (
                      <div className="flex gap-2 items-center text-xs text-muted-foreground ml-10">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                        {otherUser?.name} is typing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-border flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={handleTyping}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="bg-[var(--brand)] text-white shrink-0"
                      size="icon"
                    >
                      {sending ? <Spinner className="size-4" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
