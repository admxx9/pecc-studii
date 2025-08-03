
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Send, UserCircle, MessageSquareReply, Smile, MoreHorizontal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';


// Mock data for channels - can be moved to Firestore later
const channels = [
  { id: '1', name: 'geral' },
  { id: '2', name: 'dúvidas' },
  { id: '3', name: 'projetos' },
  { id: '4', name: 'off-topic' },
];

interface ChatMessage {
  id: string;
  text: string;
  user: {
    uid: string;
    name: string;
    avatar: string | null;
  };
  createdAt: Timestamp; // Using Firestore Timestamp
}

interface ChatContentProps {
  userProfile: UserProfile | null;
}

export default function ChatContent({ userProfile }: ChatContentProps) {
  const [activeChannel, setActiveChannel] = useState('1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Firestore listener for messages
  useEffect(() => {
    if (!db || !activeChannel) return;
    setIsLoadingMessages(true);

    const messagesCol = collection(db, 'chatChannels', activeChannel, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      setIsLoadingMessages(false);
      // Optionally show a toast error
    });

    // Cleanup listener on component unmount or when channel changes
    return () => unsubscribe();
  }, [activeChannel]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !userProfile || !db) return;

    const messagesCol = collection(db, 'chatChannels', activeChannel, 'messages');

    try {
      await addDoc(messagesCol, {
        text: newMessage,
        user: {
          uid: userProfile.uid,
          name: userProfile.displayName,
          avatar: userProfile.photoURL,
        },
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally show a toast error
    }
  };

  const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp || !timestamp.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

   // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);


  return (
    <div className="flex h-[calc(100vh-var(--header-height)-var(--footer-height,0px)-2rem)] w-full bg-secondary/40 rounded-lg border border-border">
      {/* Channel List Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-card/50 p-2 flex flex-col">
        <h2 className="text-md font-semibold text-foreground px-2 py-1 mb-2">Canais</h2>
        <ScrollArea className="flex-1">
          <nav className="space-y-1">
            {channels.map(channel => (
              <Button
                key={channel.id}
                variant="ghost"
                onClick={() => setActiveChannel(channel.id)}
                className={cn(
                  'w-full justify-start text-muted-foreground',
                  activeChannel === channel.id && 'bg-accent text-accent-foreground'
                )}
              >
                <Hash className="mr-2 h-4 w-4" />
                {channel.name}
              </Button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat Header */}
        <header className="flex items-center h-14 border-b border-border px-4 flex-shrink-0">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground ml-1">
            {channels.find(c => c.id === activeChannel)?.name}
          </h1>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="flex flex-col min-h-full justify-end">
                <div className="space-y-4 pr-4">
                  {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                      <div className="flex justify-center items-center h-full">
                          <p className="text-muted-foreground text-sm">Seja o primeiro a enviar uma mensagem em #{channels.find(c => c.id === activeChannel)?.name}!</p>
                      </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className="group relative flex items-start gap-3 p-2 rounded-md hover:bg-accent/5">
                        {/* Message Actions - Appears on hover */}
                         <div className="absolute top-0 right-2 -mt-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="flex items-center gap-1 bg-card border border-border rounded-md shadow-md p-1">
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                 <Smile className="h-4 w-4" />
                                 <span className="sr-only">Adicionar Reação</span>
                               </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                 <MessageSquareReply className="h-4 w-4" />
                                  <span className="sr-only">Responder</span>
                               </Button>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                 <MoreHorizontal className="h-4 w-4" />
                                 <span className="sr-only">Mais</span>
                               </Button>
                            </div>
                         </div>
                        {/* End Message Actions */}

                        <Avatar className="h-10 w-10 border">
                            <AvatarImage src={msg.user.avatar || undefined} />
                            <AvatarFallback>
                                 {msg.user.name ? msg.user.name.substring(0, 2).toUpperCase() : <UserCircle />}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                            <p className="font-semibold text-foreground">{msg.user.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                            </div>
                            <p className="text-sm text-foreground/90">{msg.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
        </div>


        {/* Message Input */}
        <div className="p-4 border-t border-border mt-auto flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Conversar em #${channels.find(c => c.id === activeChannel)?.name}`}
              className="flex-1 bg-input"
              autoComplete="off"
              disabled={!userProfile}
            />
            <Button type="submit" size="icon" className="flex-shrink-0" disabled={!userProfile || newMessage.trim() === ''}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

    