
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Send, UserCircle, MessageSquareReply, Smile, MoreHorizontal, Loader2, X, Trash2, Copy as CopyIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";


// Mock data for channels - can be moved to Firestore later
const channels = [
  { id: '1', name: 'geral' },
  { id: '2', name: 'dúvidas' },
  { id: '3', name: 'projetos' },
  { id: '4', name: 'off-topic' },
];

interface ReplyInfo {
  messageId: string;
  text: string;
  authorName: string;
}

interface ChatMessage {
  id: string;
  text: string;
  user: {
    uid: string;
    name: string;
    avatar: string | null;
  };
  createdAt: Timestamp; // Using Firestore Timestamp
  replyTo?: ReplyInfo | null;
}

interface ChatContentProps {
  userProfile: UserProfile | null;
}

export default function ChatContent({ userProfile }: ChatContentProps) {
  const [activeChannel, setActiveChannel] = useState('1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        replyTo: replyingTo ? {
          messageId: replyingTo.id,
          text: replyingTo.text,
          authorName: replyingTo.user.name,
        } : null,
      });
      setNewMessage('');
      setReplyingTo(null); // Clear reply state after sending
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally show a toast error
    }
  };

  const handleReplyClick = (message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!db) return;
    
    const messageToDelete = messages.find(m => m.id === messageId);
    if (!messageToDelete) return;

    // Permission Check
    const isOwner = userProfile?.uid === messageToDelete.user.uid;
    const isAdmin = userProfile?.isAdmin === true;

    if (!isOwner && !isAdmin) {
         toast({
            title: "Acesso Negado",
            description: "Você não tem permissão para excluir esta mensagem.",
            variant: "destructive",
        });
        return;
    }

    const messageRef = doc(db, 'chatChannels', activeChannel, 'messages', messageId);
    try {
      await deleteDoc(messageRef);
      toast({
        title: "Mensagem Excluída",
        description: "A mensagem foi removida do chat.",
        variant: 'default',
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a mensagem.",
        variant: "destructive",
      });
    }
  };

   const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Texto copiado!" });
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({ title: "Erro", description: "Não foi possível copiar o texto.", variant: "destructive"});
        });
    };


  const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp || !timestamp.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

   // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight effect
      element.classList.add('bg-primary/10', 'transition-all', 'duration-500');
      setTimeout(() => {
        element.classList.remove('bg-primary/10');
      }, 2000); // Remove highlight after 2 seconds
    }
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

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
             <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
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
                    messages.map(msg => {
                      const canDelete = userProfile?.isAdmin || userProfile?.uid === msg.user.uid;
                      return (
                        <div key={msg.id} id={`message-${msg.id}`} className="group relative flex items-start gap-3 p-2 rounded-md hover:bg-accent/5">
                         {/* Message Actions - Appears on hover */}
                         <div className="absolute top-0 right-2 -mt-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="flex items-center gap-1 bg-card border border-border rounded-md shadow-md p-1">
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                 <Smile className="h-4 w-4" />
                                 <span className="sr-only">Adicionar Reação</span>
                               </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleReplyClick(msg)}>
                                 <MessageSquareReply className="h-4 w-4" />
                                  <span className="sr-only">Responder</span>
                               </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                       <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                         <MoreHorizontal className="h-4 w-4" />
                                         <span className="sr-only">Mais</span>
                                       </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-card border-border">
                                        <DropdownMenuItem onSelect={() => handleReplyClick(msg)} className="cursor-pointer">
                                             <MessageSquareReply className="mr-2 h-4 w-4" />
                                            <span>Responder</span>
                                        </DropdownMenuItem>
                                         <DropdownMenuItem onSelect={() => handleCopyText(msg.text)} className="cursor-pointer">
                                            <CopyIcon className="mr-2 h-4 w-4" />
                                            <span>Copiar Texto</span>
                                        </DropdownMenuItem>
                                        {canDelete && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => handleDeleteMessage(msg.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Excluir Mensagem</span>
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                            {msg.replyTo && (
                                <button
                                  onClick={() => handleScrollToMessage(msg.replyTo.messageId)}
                                  className="w-full text-left mb-1 text-xs text-muted-foreground flex items-center hover:bg-secondary p-1 rounded-md"
                                >
                                     <MessageSquareReply className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                    Respondendo a <span className="font-semibold text-foreground/80 mx-1">{msg.replyTo.authorName}</span>:
                                    <p className="ml-1 italic truncate max-w-[200px]">"{msg.replyTo.text}"</p>
                                </button>
                            )}
                            <div className="flex items-baseline gap-2">
                                <p className="font-semibold text-foreground">{msg.user.name}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                            </div>
                            <p className="text-sm text-foreground/90">{msg.text}</p>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
            </ScrollArea>
        </div>


        {/* Message Input */}
         <div className="p-4 border-t border-border mt-auto flex-shrink-0">
            {replyingTo && (
                <div className="bg-secondary/80 text-xs text-muted-foreground p-2 rounded-t-md flex justify-between items-center animate-in fade-in-20">
                     <div className="truncate">
                        Respondendo a <span className="font-semibold text-foreground/80">{replyingTo.user.name}</span>:
                         <span className="italic ml-1">"{replyingTo.text}"</span>
                     </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={cancelReply}>
                        <X className="h-3 w-3" />
                        <span className="sr-only">Cancelar Resposta</span>
                    </Button>
                </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Conversar em #${channels.find(c => c.id === activeChannel)?.name}`}
                  className={cn("flex-1 bg-input", replyingTo && "rounded-t-none")}
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
