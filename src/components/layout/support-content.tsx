
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, UserCircle, MessageSquareReply, X, Trash2, Copy, MoreHorizontal, ChevronLeft, LifeBuoy, Ticket, Loader2, MessageSquarePlus, Search } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";


import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDocs, where, or, writeBatch } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { ranks, rankIcons } from '@/config/ranks';

interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  userName: string;
  userId: string;
  createdAt: Timestamp;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
}

interface ChatMessage {
  id: string;
  text: string;
  user: {
    uid: string;
    name: string;
    avatar: string | null;
    rank?: string;
    isAdmin?: boolean;
  };
  createdAt: Timestamp;
  replyTo?: { messageId: string; text: string; authorName: string } | null;
  isBotMessage?: boolean;
}

interface SupportContentProps {
  userProfile: UserProfile | null;
  triggerSalesTicket: boolean;
  onSalesTicketHandled: () => void;
}

const renderMessageText = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_À-ú]+)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, index) => {
        if (mentionRegex.test(part)) return <strong key={index} className="bg-accent/50 text-accent-foreground rounded px-1">{part}</strong>;
        return part;
    });
};

const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};


export default function SupportContent({ userProfile, triggerSalesTicket, onSalesTicketHandled }: SupportContentProps) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [ticketToDelete, setTicketToDelete] = useState<SupportTicket | null>(null);
    const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
    const [searchTerm, setSearchTerm] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Fetch tickets
    useEffect(() => {
        if (!db || !userProfile) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const q = userProfile.isAdmin
            ? query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'))
            : query(collection(db, 'supportTickets'), where('userId', '==', userProfile.uid), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
            setTickets(fetchedTickets);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching tickets:", error);
            toast({ title: "Erro", description: "Não foi possível carregar os tickets de suporte.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile, toast]);

    // Fetch messages for active ticket
    useEffect(() => {
        if (!activeTicket || !db) {
            setMessages([]);
            return;
        }
        const msgQuery = query(collection(db, 'supportTickets', activeTicket.id, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChatMessage));
        });
        return () => unsubscribe();
    }, [activeTicket]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages]);

    const handleCreateTicket = async () => {
        if (!userProfile || !db) {
             toast({ title: "Ação Necessária", description: "Faça login para criar um ticket.", variant: "destructive" });
             return;
        }
        setIsCreating(true);
        try {
            const newTicketRef = await addDoc(collection(db, 'supportTickets'), {
                subject: `Ticket de Suporte - ${userProfile.displayName}`,
                status: 'open',
                userId: userProfile.uid,
                userName: userProfile.displayName,
                createdAt: serverTimestamp(),
            });

            await addDoc(collection(newTicketRef, 'messages'), {
                text: `Olá ${userProfile.displayName}! Descreva seu problema em detalhes e um administrador irá respondê-lo em breve.`,
                user: { uid: 'bot', name: 'Assistente de Suporte', avatar: 'https://i.imgur.com/sXliRZl.png', isAdmin: true },
                createdAt: serverTimestamp(),
                isBotMessage: true,
            });

            toast({ title: "Ticket Criado!", description: `Seu ticket de suporte foi aberto com sucesso.`, className: "bg-green-600 text-white" });
            setActiveTicket({ id: newTicketRef.id, subject: `Ticket de Suporte - ${userProfile.displayName}`, status: 'open', userId: userProfile.uid, userName: userProfile.displayName, createdAt: new Timestamp(Date.now() / 1000, 0) });
        } catch (error) {
             console.error("Error creating ticket:", error);
             toast({ title: "Erro", description: "Não foi possível criar seu ticket.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !userProfile || !db || !activeTicket || activeTicket.status === 'closed') return;
        
        try {
            const ticketRef = doc(db, 'supportTickets', activeTicket.id);
            const batch = writeBatch(db);

            batch.update(ticketRef, {
                lastMessage: newMessage,
                lastMessageAt: serverTimestamp(),
            });

            const messageRef = doc(collection(ticketRef, 'messages'));
            batch.set(messageRef, {
                text: newMessage,
                user: { uid: userProfile.uid, name: userProfile.displayName, avatar: userProfile.photoURL, rank: userProfile.rank, isAdmin: userProfile.isAdmin },
                createdAt: serverTimestamp(),
                replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text, authorName: replyingTo.user.name } : null,
            });

            await batch.commit();
            setNewMessage(''); 
            setReplyingTo(null);
        } catch (error) {
            console.error("Error sending message:", error);
            toast({ title: "Erro", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
        }
    };

    const handleTicketStatusChange = async (ticket: SupportTicket, status: 'open' | 'closed') => {
        if (!db) return;
        const ticketRef = doc(db, 'supportTickets', ticket.id);
        await updateDoc(ticketRef, { status });
        toast({ title: `Ticket ${status === 'closed' ? 'Fechado' : 'Reaberto'}`, description: `O ticket foi ${status === 'closed' ? 'fechado' : 'reaberto'} com sucesso.` });
        if (status === 'closed' && activeTicket?.id === ticket.id) {
            setActiveTicket(null);
        }
    };

    const handleDeleteTicket = async () => {
        if (!ticketToDelete || !db) return;
        try {
            await deleteDoc(doc(db, 'supportTickets', ticketToDelete.id));
            toast({ title: "Ticket Excluído", description: "O ticket e todas as suas mensagens foram removidos." });
            if (activeTicket?.id === ticketToDelete.id) {
                setActiveTicket(null);
            }
            setTicketToDelete(null);
        } catch (error) {
            console.error("Error deleting ticket:", error);
            toast({ title: "Erro", description: "Não foi possível excluir o ticket.", variant: "destructive" });
        }
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const statusMatch = filter === 'all' || ticket.status === filter;
            const searchMatch = searchTerm === '' || ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) || ticket.subject.toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && searchMatch;
        });
    }, [tickets, filter, searchTerm]);


    if (activeTicket) {
        return (
            <div className="flex flex-col w-full bg-card rounded-lg border border-border h-full max-h-[calc(100vh-var(--header-height)-4rem)]">
                <header className="flex items-center h-14 border-b border-border px-4 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="mr-2" onClick={() => setActiveTicket(null)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 truncate">
                        <h1 className="text-lg font-semibold text-foreground truncate">{activeTicket.subject}</h1>
                        <p className="text-xs text-muted-foreground">Ticket com {activeTicket.userName}</p>
                    </div>
                    {userProfile?.isAdmin && (
                        <Button variant={activeTicket.status === 'open' ? 'destructive' : 'default'} size="sm" onClick={() => handleTicketStatusChange(activeTicket, activeTicket.status === 'open' ? 'closed' : 'open')}>
                            {activeTicket.status === 'open' ? 'Fechar Ticket' : 'Reabrir Ticket'}
                        </Button>
                    )}
                </header>
                <ScrollArea className="flex-1" ref={scrollAreaRef}>
                    <div className="p-4 space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className="group relative flex items-start gap-3 p-2 rounded-md hover:bg-accent/5">
                                <Avatar className="h-10 w-10 border"><AvatarImage src={msg.user.avatar || undefined} /><AvatarFallback>{msg.user.name ? msg.user.name.substring(0, 2).toUpperCase() : <UserCircle />}</AvatarFallback></Avatar>
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-semibold text-foreground">{msg.user.name}</span>
                                        <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                                    </div>
                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{renderMessageText(msg.text)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t border-border mt-auto flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={`Conversar em #${activeTicket.subject}`} className="flex-1 bg-input" autoComplete="off" disabled={activeTicket.status === 'closed'} />
                        <Button type="submit" size="icon" className="flex-shrink-0" disabled={newMessage.trim() === '' || activeTicket.status === 'closed'}><Send className="h-4 w-4" /></Button>
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <Card className="w-full h-full flex flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl">Central de Suporte</CardTitle>
                        <CardDescription>Veja seus tickets ou abra um novo chamado.</CardDescription>
                    </div>
                    <Button onClick={handleCreateTicket} disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
                        Abrir Novo Ticket
                    </Button>
                </div>
                 {userProfile?.isAdmin && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nome ou assunto..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por status..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Tickets</SelectItem>
                                <SelectItem value="open">Abertos</SelectItem>
                                <SelectItem value="closed">Fechados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                    <div className="p-6 pt-0">
                        {isLoading ? (
                            <div className="space-y-3">
                                <div className="h-16 bg-muted rounded-md animate-pulse"></div>
                                <div className="h-16 bg-muted rounded-md animate-pulse"></div>
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                <LifeBuoy className="mx-auto h-12 w-12" />
                                <h3 className="mt-4 text-lg font-semibold">Nenhum ticket encontrado</h3>
                                <p className="mt-1 text-sm">Você não tem tickets de suporte no momento.</p>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {filteredTickets.map(ticket => (
                                    <li key={ticket.id} onClick={() => setActiveTicket(ticket)} className="p-3 bg-secondary rounded-md cursor-pointer hover:bg-accent transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-foreground truncate">{ticket.subject}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {userProfile?.isAdmin ? `Usuário: ${ticket.userName}` : 'Clique para ver as mensagens'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={ticket.status === 'open' ? 'success' : 'destructive'}>{ticket.status}</Badge>
                                                {userProfile?.isAdmin && (
                                                     <AlertDialog onOpenChange={(open) => !open && setTicketToDelete(null)}>
                                                        <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir Ticket?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Tem certeza que deseja excluir este ticket? Todas as mensagens serão perdidas permanentemente.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => {e.stopPropagation(); setTicketToDelete(ticket); handleDeleteTicket();}}>Excluir</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

    