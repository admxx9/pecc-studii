'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Send, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';


// Mock data for channels and messages
const channels = [
  { id: '1', name: 'geral' },
  { id: '2', name: 'dúvidas' },
  { id: '3', name: 'projetos' },
  { id: '4', name: 'off-topic' },
];

const initialMessages = {
  '1': [
    { id: 'm1', text: 'Bem-vindo ao canal #geral!', user: { name: 'Admin', avatar: '' }, timestamp: '10:00 AM' },
  ],
  '2': [
    { id: 'm2', text: 'Tem alguma dúvida? Pergunte aqui.', user: { name: 'Admin', avatar: '' }, timestamp: '10:01 AM' },
  ],
  '3': [],
  '4': [],
};

interface ChatContentProps {
  userProfile: UserProfile | null;
}

export default function ChatContent({ userProfile }: ChatContentProps) {
  const [activeChannel, setActiveChannel] = useState('1');
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !userProfile) return;

    const message = {
      id: `m${Date.now()}`,
      text: newMessage,
      user: { name: userProfile.displayName, avatar: userProfile.photoURL },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => ({
      ...prev,
      [activeChannel]: [...prev[activeChannel as keyof typeof prev], message],
    }));
    setNewMessage('');
  };


  return (
    <div className="flex h-full w-full bg-secondary/40 rounded-lg border border-border">
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

        {/* Messages Area - This now grows */}
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
                <div className="space-y-4 pr-4">
                {messages[activeChannel as keyof typeof messages].map(msg => (
                    <div key={msg.id} className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={msg.user.avatar || undefined} />
                        <AvatarFallback>
                             {msg.user.name ? msg.user.name.substring(0, 2).toUpperCase() : <UserCircle />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                        <p className="font-semibold text-foreground">{msg.user.name}</p>
                        <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                        </div>
                        <p className="text-sm text-foreground/90">{msg.text}</p>
                    </div>
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>


        {/* Message Input - This is pushed to the bottom */}
        <div className="p-4 border-t border-border mt-auto flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Conversar em #${channels.find(c => c.id === activeChannel)?.name}`}
              className="flex-1 bg-input"
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
