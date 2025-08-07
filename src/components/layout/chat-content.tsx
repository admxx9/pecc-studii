
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Send, UserCircle, MessageSquareReply, Smile, MoreHorizontal, Loader2, X, Trash2, Copy as CopyIcon, Settings, Plus, GripVertical, Edit, Lock, Ticket as TicketIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // Import Badge

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, where, getDocs, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";


// --- Types ---
interface ChatCategory {
    id: string;
    name: string;
    order: number;
    createdAt: Timestamp;
}

interface ChatChannel {
    id: string;
    name: string;
    categoryId: string;
    isPrivate?: boolean; // For tickets
    allowedUsers?: string[]; // UIDs of users who can see it
}

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
  reactions?: { [emoji: string]: string[] }; // Map of emoji to array of user UIDs
  isBotMessage?: boolean; // Flag for bot messages
  actions?: { text: string; actionId: string }[];
}

interface ChatContentProps {
  userProfile: UserProfile | null;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🤔'];

// Static Support Channel & Category IDs
const SUPPORT_CATEGORY_ID = 'support-category';
const SUPPORT_CHANNEL_ID = 'support-channel';
const TICKETS_CATEGORY_ID = 'tickets-category';


// --- Static Support Content ---
const botMessage: ChatMessage = {
    id: 'bot-message-1',
    text: 'Bem-vindo ao canal de suporte! Se precisar de ajuda, clique no botão abaixo para abrir um ticket privado e nossa equipe irá atendê-lo.',
    user: {
        uid: 'bot',
        name: 'STUDIO PECC', // The main name part
        avatar: 'https://i.imgur.com/sXliRZl.png', // Logo as avatar
    },
    createdAt: new Timestamp(new Date().getTime() / 1000, 0),
    isBotMessage: true,
    actions: [{ text: 'Abrir Ticket', actionId: 'create-ticket' }],
};

const supportCategory: ChatCategory = {
  id: SUPPORT_CATEGORY_ID,
  name: 'Suporte',
  order: -1, // Ensures it's always at the top
  createdAt: new Timestamp(0, 0),
};

const supportChannel: ChatChannel = {
  id: SUPPORT_CHANNEL_ID,
  name: 'suporte',
  categoryId: SUPPORT_CATEGORY_ID,
};


export default function ChatContent({ userProfile }: ChatContentProps) {
    const [categories, setCategories] = useState<ChatCategory[]>([]);
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // State for modals
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
    const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<{ categoryId: string, channel?: ChatChannel } | null>(null);
    const [editingCategory, setEditingCategory] = useState<ChatCategory | null>(null);
    const [channelName, setChannelName] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryOrder, setNewCategoryOrder] = useState(0);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'channel' | 'category', item: ChatChannel | ChatCategory } | null>(null);



    const fetchSidebarData = useCallback(async () => {
        if (!db) return;
        setIsLoading(true);

        try {
            const categoriesQuery = query(collection(db, 'chatCategories'), orderBy('order', 'asc'));
            const channelsQuery = query(collection(db, 'chatChannels'), orderBy('createdAt', 'asc'));

            const [categoriesSnapshot, channelsSnapshot] = await Promise.all([
                getDocs(categoriesQuery),
                getDocs(channelsQuery)
            ]);

            const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatCategory[];
            const fetchedChannels = channelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatChannel[];

            const allCategories = [supportCategory, ...fetchedCategories];
            const userHasTickets = fetchedChannels.some(c => c.isPrivate && c.allowedUsers?.includes(userProfile?.uid || ''));
            const ticketsCategoryExists = allCategories.some(c => c.id === TICKETS_CATEGORY_ID);

            if ((userProfile?.isAdmin || userHasTickets) && !ticketsCategoryExists) {
                allCategories.splice(1, 0, {
                    id: TICKETS_CATEGORY_ID,
                    name: 'Tickets',
                    order: 0,
                    createdAt: new Timestamp(0, 0),
                });
            }

            setCategories(allCategories);

            const visibleChannels = fetchedChannels.filter(channel => {
                if (!channel.isPrivate) return true;
                if (userProfile?.isAdmin) return true;
                return channel.allowedUsers?.includes(userProfile?.uid || '');
            });

            const allVisibleChannels = [supportChannel, ...visibleChannels];
            setChannels(allVisibleChannels);

            if (allVisibleChannels.length > 0 && !activeChannel) {
                setActiveChannel(supportChannel);
            }

        } catch (error) {
            console.error("Error fetching sidebar data:", error);
            toast({ title: "Erro", description: "Não foi possível carregar os canais.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [userProfile?.uid, userProfile?.isAdmin, toast]);


    useEffect(() => {
        fetchSidebarData();
    }, [fetchSidebarData, activeChannel]);


  // Firestore listener for messages
  useEffect(() => {
     if (activeChannel?.id === SUPPORT_CHANNEL_ID) {
        setMessages([botMessage]);
        return;
    }
    if (!db || !activeChannel) {
        setMessages([]);
        return;
    };

    const messagesCol = collection(db, 'chatChannels', activeChannel.id, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as mensagens.", variant: "destructive"});
    });

    return () => unsubscribe();
  }, [activeChannel, toast]);


  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);


  // --- Event Handlers ---
   const handleBotActionClick = async (actionId: string) => {
        if (actionId === 'create-ticket') {
            await handleCreateTicket();
        } else if (actionId === 'close-ticket') {
            if (activeChannel) {
                setItemToDelete({ type: 'channel', item: activeChannel });
            }
        }
    };

    const handleCreateTicket = async () => {
        if (!userProfile || !db) {
            toast({ title: "Erro", description: "Você precisa estar logado para criar um ticket.", variant: "destructive" });
            return;
        }
        setIsCreatingTicket(true);
        try {
            // Check if user already has an open ticket to prevent spam
            const ticketsQuery = query(collection(db, 'chatChannels'), where('isPrivate', '==', true), where('allowedUsers', 'array-contains', userProfile.uid));
            const existingTickets = await getDocs(ticketsQuery);
            if (!existingTickets.empty) {
                toast({ title: "Ticket Existente", description: "Você já possui um ticket aberto. Nossa equipe entrará em contato em breve.", variant: "default", className: "bg-yellow-500 border-yellow-500 text-black" });
                // Navigate to existing ticket
                const existingTicketChannel = { id: existingTickets.docs[0].id, ...existingTickets.docs[0].data() } as ChatChannel;
                setActiveChannel(existingTicketChannel);
                return;
            }

            // Create new private channel (ticket)
            const ticketName = `ticket-${userProfile.displayName.toLowerCase().replace(/\s/g, '-')}`;
            const newChannelRef = await addDoc(collection(db, 'chatChannels'), {
                name: ticketName,
                categoryId: TICKETS_CATEGORY_ID,
                isPrivate: true,
                allowedUsers: [userProfile.uid], // Initially only the user can see it (admins logic is separate)
                createdAt: serverTimestamp(),
            });

             // Add a welcome message to the new ticket channel
            await addDoc(collection(newChannelRef, 'messages'), {
                 text: `Olá ${userProfile.displayName}! Descreva seu problema em detalhes e um administrador irá respondê-lo em breve. Quando o problema for resolvido, você ou um administrador podem fechar este ticket.`,
                 user: { uid: 'bot', name: 'STUDIO PECC', avatar: 'https://i.imgur.com/sXliRZl.png' },
                 createdAt: serverTimestamp(),
                 isBotMessage: true,
                 actions: [{ text: 'Fechar Ticket', actionId: 'close-ticket' }],
            });

            toast({ title: "Ticket Criado!", description: `O canal #${ticketName} foi criado.`, className: "bg-green-600 text-white" });
            
            // Refetch channels to include the new one and navigate to it
            const newChannel = { id: newChannelRef.id, name: ticketName, categoryId: TICKETS_CATEGORY_ID, isPrivate: true, allowedUsers: [userProfile.uid], createdAt: new Timestamp(Date.now() / 1000, 0) };
            setChannels(prev => [...prev, newChannel].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds));
            setActiveChannel(newChannel);

        } catch (error) {
            console.error("Error creating ticket:", error);
            toast({ title: "Erro ao Criar Ticket", description: "Não foi possível criar seu ticket.", variant: "destructive" });
        } finally {
            setIsCreatingTicket(false);
        }
    };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !userProfile || !db || !activeChannel || activeChannel.id === SUPPORT_CHANNEL_ID) return;

    const messagesCol = collection(db, 'chatChannels', activeChannel.id, 'messages');

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
        reactions: {},
      });
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Erro", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
    }
  };

    const handleChannelClick = (channel: ChatChannel) => {
        setActiveChannel(channel);
    };

    const handleReplyClick = (message: ChatMessage) => {
        if(message.isBotMessage) return;
        setReplyingTo(message);
        inputRef.current?.focus();
    };

    const cancelReply = () => setReplyingTo(null);

    const handleDeleteMessage = async (messageId: string) => {
        if (!db || !activeChannel || activeChannel.id === SUPPORT_CHANNEL_ID) return;
        const isOwner = messages.find(m => m.id === messageId)?.user.uid === userProfile?.uid;
        if (!isOwner && !userProfile?.isAdmin) {
            toast({ title: "Acesso Negado", description: "Você não tem permissão para excluir esta mensagem.", variant: "destructive" });
            return;
        }
        const messageRef = doc(db, 'chatChannels', activeChannel.id, 'messages', messageId);
        await deleteDoc(messageRef);
        toast({ title: "Mensagem Excluída", variant: 'default' });
    };

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text).then(() => toast({ title: "Texto copiado!" }));
    };

    const handleReaction = async (message: ChatMessage, emoji: string) => {
        if (!userProfile || !db || !activeChannel || message.isBotMessage) return;
        const messageRef = doc(db, 'chatChannels', activeChannel.id, 'messages', message.id);
        const usersWhoReacted = message.reactions?.[emoji] || [];
        const userHasReacted = usersWhoReacted.includes(userProfile.uid);
        const fieldPath = `reactions.${emoji}`;
        await updateDoc(messageRef, { [fieldPath]: userHasReacted ? arrayRemove(userProfile.uid) : arrayUnion(userProfile.uid) });
    };

    const formatDate = (timestamp: Timestamp | null | undefined): string => {
        if (!timestamp?.toDate) return '';
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleScrollToMessage = (messageId: string) => {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-primary/10', 'transition-all', 'duration-500');
            setTimeout(() => element.classList.remove('bg-primary/10'), 2000);
        }
    };


    // --- Channel/Category Management ---
    const handleOpenChannelModal = (categoryId?: string, channel?: ChatChannel) => {
        setEditingChannel(channel ? { categoryId: channel.categoryId, channel } : { categoryId: categoryId || '' });
        setChannelName(channel?.name || '');
        setSelectedCategoryId(channel?.categoryId || categoryId || '');
        setIsChannelModalOpen(true);
    };

    const handleOpenCategoryModal = (category?: ChatCategory) => {
        setEditingCategory(category || null);
        setNewCategoryName(category?.name || '');
        setNewCategoryOrder(category?.order || categories.length + 1);
        setIsCategoryModalOpen(true);
    };

    const handleSaveChannel = async () => {
        if (!channelName.trim() || !selectedCategoryId || !db) {
             toast({ title: "Erro", description: "Nome do canal e categoria são obrigatórios.", variant: "destructive" });
            return;
        }
        const { channel } = editingChannel || {};

        try {
            if (channel) { // Editing existing channel
                const channelRef = doc(db, 'chatChannels', channel.id);
                await updateDoc(channelRef, { name: channelName.trim(), categoryId: selectedCategoryId });
                toast({ title: "Canal Atualizado!" });
            } else { // Creating new channel
                await addDoc(collection(db, 'chatChannels'), {
                    name: channelName.trim(),
                    categoryId: selectedCategoryId,
                    isPrivate: false,
                    allowedUsers: [],
                    createdAt: serverTimestamp(),
                });
                toast({ title: "Canal Criado!" });
            }
            // Refresh local state (simple refetch for now)
             const channelsSnapshot = await getDocs(query(collection(db, 'chatChannels'), orderBy('createdAt', 'asc')));
             const fetchedChannels = channelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatChannel[];
             setChannels([supportChannel, ...fetchedChannels]);

            setIsChannelModalOpen(false);
            setEditingChannel(null);
            setChannelName('');
        } catch (error) {
            console.error("Error saving channel:", error);
            toast({ title: "Erro", description: "Não foi possível salvar o canal.", variant: "destructive" });
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim() || !db) {
            toast({ title: "Erro", description: "Nome da categoria é obrigatório.", variant: "destructive" });
            return;
        }

        try {
            if (editingCategory) {
                const categoryRef = doc(db, 'chatCategories', editingCategory.id);
                await updateDoc(categoryRef, { name: newCategoryName.trim(), order: newCategoryOrder });
                toast({ title: "Categoria Atualizada!" });
            } else {
                await addDoc(collection(db, 'chatCategories'), {
                    name: newCategoryName.trim(),
                    order: newCategoryOrder,
                    createdAt: serverTimestamp(),
                });
                toast({ title: "Categoria Criada!" });
            }


            // Refetch categories to update the list
            const categoriesSnapshot = await getDocs(query(collection(db, 'chatCategories'), orderBy('order', 'asc')));
            const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatCategory[];
            setCategories([supportCategory, ...fetchedCategories]);

            setIsCategoryModalOpen(false);
            setNewCategoryName('');
            setNewCategoryOrder(0);
            setEditingCategory(null);
        } catch (error) {
            console.error("Error saving category:", error);
            toast({ title: "Erro", description: "Não foi possível salvar a categoria.", variant: "destructive" });
        }
    };
    
    const handleDeleteConfirmation = async () => {
        if (!itemToDelete || !db) return;

        const { type, item } = itemToDelete;
        
        try {
            if (type === 'channel') {
                const channel = item as ChatChannel;
                // TODO: Also delete all messages within the channel in a batch
                await deleteDoc(doc(db, 'chatChannels', channel.id));
                setChannels(prev => prev.filter(c => c.id !== channel.id));
                // If the deleted channel was active, switch to support channel
                if (activeChannel?.id === channel.id) {
                    setActiveChannel(supportChannel);
                }
                toast({ title: "Canal Excluído", description: `O canal #${channel.name} foi removido.` });
            } else if (type === 'category') {
                const category = item as ChatCategory;
                const batch = writeBatch(db);

                // Find and delete channels in this category
                const channelsToDelete = channels.filter(c => c.categoryId === category.id);
                channelsToDelete.forEach(c => {
                    // TODO: Also delete all messages within each channel
                    batch.delete(doc(db, 'chatChannels', c.id));
                     if (activeChannel?.categoryId === c.categoryId) {
                        setActiveChannel(supportChannel);
                    }
                });

                // Delete the category itself
                batch.delete(doc(db, 'chatCategories', category.id));

                await batch.commit();

                setCategories(prev => prev.filter(c => c.id !== category.id));
                setChannels(prev => prev.filter(c => c.categoryId !== category.id));
                toast({ title: "Categoria Excluída", description: `A categoria ${category.name} e todos os seus canais foram removidos.` });
            }
        } catch (error) {
             console.error(`Error deleting ${type}:`, error);
            toast({ title: "Erro", description: `Não foi possível excluir.`, variant: "destructive" });
        } finally {
            setItemToDelete(null);
        }
    };


  return (
    <div className="flex w-full bg-secondary/40 rounded-lg border border-border h-[calc(100vh-var(--header-height)-4rem)]">
      {/* Channel List Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-card/50 p-2 flex flex-col">
         <header className="flex items-center justify-between p-2 mb-1">
            <h2 className="text-md font-semibold text-foreground">Canais</h2>
            {userProfile?.isAdmin && (
                <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleOpenChannelModal()}>Criar Canal</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleOpenCategoryModal()}>Criar Categoria</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </header>
        <ScrollArea className="flex-1">
          {isLoading ? (
             <div className="p-2 space-y-2">
                <div className="h-8 bg-muted rounded-md animate-pulse"></div>
                <div className="h-6 bg-muted rounded-md animate-pulse ml-4"></div>
             </div>
          ) : (
            <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="w-full">
                {categories.map(category => (
                    <AccordionItem value={category.id} key={category.id} className="border-b-0 group">
                        <ContextMenu>
                            <ContextMenuTrigger disabled={!userProfile?.isAdmin || category.id === SUPPORT_CATEGORY_ID || category.id === TICKETS_CATEGORY_ID}>
                                <div className="flex items-center justify-between group">
                                        <AccordionTrigger className="flex-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground py-1 px-2 rounded-md">
                                            {category.name}
                                        </AccordionTrigger>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => handleOpenCategoryModal(category)}>Editar Categoria</ContextMenuItem>
                                <ContextMenuItem onSelect={() => setItemToDelete({ type: 'category', item: category })} className="text-destructive">Excluir Categoria</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                        <AccordionContent className="pl-2 pb-1">
                            <nav className="space-y-1">
                                {channels.filter(c => c.categoryId === category.id).map(channel => (
                                    <ContextMenu key={channel.id}>
                                        <ContextMenuTrigger disabled={!userProfile?.isAdmin || channel.id === SUPPORT_CHANNEL_ID}>
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleChannelClick(channel)}
                                                className={cn(
                                                    'w-full justify-start text-muted-foreground',
                                                    activeChannel?.id === channel.id && 'bg-accent text-accent-foreground'
                                                )}
                                            >
                                                {channel.isPrivate ? <Lock className="mr-2 h-4 w-4" /> : <Hash className="mr-2 h-4 w-4" />}
                                                {channel.name}
                                            </Button>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                            <ContextMenuItem onSelect={() => handleOpenChannelModal(channel.categoryId, channel)}>Editar Canal</ContextMenuItem>
                                            <ContextMenuItem onSelect={() => setItemToDelete({ type: 'channel', item: channel })} className="text-destructive">Excluir Canal</ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                ))}
                            </nav>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
          )}
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat Header */}
        <header className="flex items-center h-14 border-b border-border px-4 flex-shrink-0">
          {activeChannel?.isPrivate ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Hash className="h-5 w-5 text-muted-foreground" />}
          <h1 className="text-lg font-semibold text-foreground ml-1">
            {activeChannel?.name || 'Selecione um canal'}
          </h1>
        </header>

        {/* Messages Area */}
         <div className="flex-1 overflow-hidden flex flex-col">
             <ScrollArea className="flex-1" ref={scrollAreaRef}>
                 <div className="p-4 space-y-4 pr-4 min-h-full flex flex-col justify-end">
                  {!activeChannel ? (
                     <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquareReply className="h-12 w-12 mb-4" />
                        <p>Selecione um canal para começar a conversar.</p>
                     </div>
                  ) : messages.length === 0 && activeChannel.id !== SUPPORT_CHANNEL_ID ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <p className="text-sm">Seja o primeiro a enviar uma mensagem em #{activeChannel.name}!</p>
                      </div>
                  ) : (
                    messages.map(msg => {
                      const canDelete = userProfile?.isAdmin || userProfile?.uid === msg.user.uid;
                      return (
                        <div key={msg.id} id={`message-${msg.id}`} className="group relative flex items-start gap-3 p-2 rounded-md hover:bg-accent/5">
                         {!msg.isBotMessage && (
                            <div className="absolute top-0 right-2 -mt-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <div className="flex items-center gap-1 bg-card border border-border rounded-md shadow-md p-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                        <Smile className="h-4 w-4" />
                                        <span className="sr-only">Adicionar Reação</span>
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-1 bg-card border-border">
                                    <div className="flex gap-1">
                                        {EMOJI_LIST.map(emoji => (
                                        <Button
                                            key={emoji}
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-lg rounded-full"
                                            onClick={() => handleReaction(msg, emoji)}
                                        >
                                            {emoji}
                                        </Button>
                                        ))}
                                    </div>
                                    </PopoverContent>
                                </Popover>

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
                         )}

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
                               {msg.user.uid === 'bot' ? (
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">BOT</Badge>
                                           {msg.user.name}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="font-semibold text-foreground">{msg.user.name}</p>
                                )}
                                <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                            </div>
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.text}</p>
                             {msg.actions && msg.actions.length > 0 && (
                                 <div className="mt-2 flex gap-2">
                                     {msg.actions.map(action => (
                                         <Button key={action.actionId} size="sm" onClick={() => handleBotActionClick(action.actionId)} disabled={isCreatingTicket}>
                                             {action.actionId === 'create-ticket' && (isCreatingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TicketIcon className="mr-2 h-4 w-4" />)}
                                             {action.actionId === 'close-ticket' && <Trash2 className="mr-2 h-4 w-4" />}
                                             {isCreatingTicket && action.actionId === 'create-ticket' ? 'Criando...' : action.text}
                                        </Button>
                                     ))}
                                 </div>
                             )}
                             {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                               <div className="mt-1 flex flex-wrap gap-1">
                                 {Object.entries(msg.reactions).map(([emoji, uids]) => {
                                   if (uids.length === 0) return null;
                                   const userHasReacted = userProfile && uids.includes(userProfile.uid);
                                   return (
                                     <Button
                                       key={emoji}
                                       variant="outline"
                                       size="sm"
                                       className={cn(
                                         "h-auto px-1.5 py-0.5 text-xs rounded-full border-accent/50 bg-accent/20 hover:bg-accent/40",
                                         userHasReacted && "border-primary bg-primary/20"
                                       )}
                                       onClick={() => handleReaction(msg, emoji)}
                                     >
                                       <span className="text-sm mr-1">{emoji}</span>
                                       <span className="font-mono text-xs">{uids.length}</span>
                                     </Button>
                                   );
                                 })}
                               </div>
                             )}
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
                  placeholder={activeChannel ? `Conversar em #${activeChannel.name}` : 'Selecione um canal para conversar'}
                  className={cn("flex-1 bg-input", replyingTo && "rounded-t-none")}
                  autoComplete="off"
                  disabled={!userProfile || !activeChannel || activeChannel.id === SUPPORT_CHANNEL_ID}
                />
                <Button type="submit" size="icon" className="flex-shrink-0" disabled={!userProfile || !activeChannel || newMessage.trim() === '' || activeChannel.id === SUPPORT_CHANNEL_ID}>
                  <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </div>

       {/* Channel Modal */}
       <Dialog open={isChannelModalOpen} onOpenChange={setIsChannelModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingChannel?.channel ? 'Editar Canal' : 'Criar Novo Canal'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="channel-name" className="text-right">Nome</Label>
                        <Input
                            id="channel-name"
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            className="col-span-3"
                            placeholder="ex: geral"
                        />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="channel-category" className="text-right">Categoria</Label>
                        <Select onValueChange={setSelectedCategoryId} value={selectedCategoryId}>
                            <SelectTrigger id="channel-category" className="col-span-3">
                                <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.filter(c => c.id !== SUPPORT_CATEGORY_ID).map(category => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSaveChannel}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Category Modal */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Criar Nova Categoria'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category-name" className="text-right">Nome</Label>
                        <Input
                            id="category-name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="col-span-3"
                            placeholder="ex: Geral"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category-order" className="text-right">Ordem</Label>
                        <Input
                            id="category-order"
                            type="number"
                            value={newCategoryOrder}
                            onChange={(e) => setNewCategoryOrder(Number(e.target.value))}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSaveCategory}>Salvar Categoria</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                        {itemToDelete?.type === 'channel' && `Tem certeza que quer excluir o canal #${(itemToDelete.item as ChatChannel).name}? Esta ação não pode ser desfeita.`}
                        {itemToDelete?.type === 'category' && `Tem certeza que quer excluir a categoria ${(itemToDelete.item as ChatCategory).name}? TODOS os canais dentro dela serão excluídos permanentemente.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirmation} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    