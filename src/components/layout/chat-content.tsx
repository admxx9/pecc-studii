
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Send, UserCircle, MessageSquareReply, Smile, MoreHorizontal, Loader2, X, Trash2, Copy as CopyIcon, Settings, Plus, GripVertical, Edit, Lock, Ticket as TicketIcon, Crown, BookOpen, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, where, getDocs, setDoc, Unsubscribe, or } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { ranks, rankKeys, rankIcons } from '@/config/ranks';
import Image from 'next/image';

interface SiteSettings {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
    isSalesBotEnabled: boolean;
}

interface ChatCategory {
    id: string;
    name: string;
    order: number;
    createdAt: Timestamp;
    allowedRanks?: string[];
}

interface ChatChannel {
    id: string;
    name: string;
    categoryId: string;
    isPrivate?: boolean;
    allowedUsers?: string[];
    createdAt: Timestamp;
    isClosed?: boolean;
    initialInterest?: 'GTA V' | 'GTA IV';
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
    rank?: string;
    isAdmin?: boolean;
  };
  createdAt: Timestamp;
  replyTo?: ReplyInfo | null;
  reactions?: { [emoji: string]: string[] };
  isBotMessage?: boolean;
  actions?: { text: string; actionId: string }[];
  messageType?: 'sales_pitch' | null;
}

interface ChatContentProps {
  userProfile: UserProfile | null;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  triggerSalesTicket: boolean;
  onSalesTicketHandled: () => void;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🤔'];

const SERVER_INFO_CATEGORY_ID = 'server-info-category';
const SERVER_INFO_CHANNEL_ID = 'server-info-channel';
const SUPPORT_CATEGORY_ID = 'support-category';
const SUPPORT_CHANNEL_ID = 'support-channel';
const TICKETS_CATEGORY_ID = 'tickets-category';
const SALES_CONSULTATION_CATEGORY_ID = 'sales-consultation-category';
const TICKETS_ARCHIVED_CATEGORY_ID = 'tickets-archived-category';

const serverInfoCategory: ChatCategory = { id: SERVER_INFO_CATEGORY_ID, name: 'Servidor', order: -10, createdAt: new Timestamp(0, 0), allowedRanks: [] };
const serverInfoChannel: ChatChannel = { id: SERVER_INFO_CHANNEL_ID, name: 'nosso-proposito', categoryId: SERVER_INFO_CATEGORY_ID, createdAt: new Timestamp(0, 0) };
const serverInfoMessage: ChatMessage = { id: 'server-info-message', text: 'Bem-vindo ao STUDIO PECC! Nossa missão é fornecer as melhores ferramentas, aulas e suporte para a comunidade de modding. Explore os canais para aprender, baixar ferramentas e interagir com outros modders. Se precisar de ajuda, vá até o canal de suporte!', user: { uid: 'bot', name: 'STUDIO PECC', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true }, createdAt: new Timestamp(new Date().getTime() / 1000, 0), isBotMessage: true };

const supportCategory: ChatCategory = { id: SUPPORT_CATEGORY_ID, name: 'Suporte', order: -9, createdAt: new Timestamp(0, 0), allowedRanks: [] };
const supportChannel: ChatChannel = { id: SUPPORT_CHANNEL_ID, name: 'suporte', categoryId: SUPPORT_CATEGORY_ID, createdAt: new Timestamp(0, 0) };
const supportBotMessage: ChatMessage = { id: 'bot-message-1', text: 'Bem-vindo ao canal de suporte! Se precisar de ajuda, clique no botão abaixo para abrir um ticket privado e nossa equipe irá atendê-lo.', user: { uid: 'bot', name: 'STUDIO PECC', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true }, createdAt: new Timestamp(new Date().getTime() / 1000, 0), isBotMessage: true, actions: [{ text: 'Abrir Ticket', actionId: 'create-ticket' }] };

const renderMessageText = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_À-ú]+)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, index) => {
        if (mentionRegex.test(part)) return <strong key={index} className="bg-accent/50 text-accent-foreground rounded px-1">{part}</strong>;
        return part;
    });
};

export default function ChatContent({ userProfile, activeChannelId, setActiveChannelId, triggerSalesTicket, onSalesTicketHandled }: ChatContentProps) {
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
    const [editingChannel, setEditingChannel] = useState<{ categoryId: string, channel?: ChatChannel } | null>(null);
    const [editingCategory, setEditingCategory] = useState<ChatCategory | null>(null);
    const [itemToManage, setItemToManage] = useState<{ type: 'channel' | 'category' | 'multichannel', action: 'delete' | 'close', item: ChatChannel | ChatCategory | ChatChannel[] } | null>(null);

    // Form state for modals
    const [channelName, setChannelName] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryOrder, setNewCategoryOrder] = useState(0);
    const [allowedRanks, setAllowedRanks] = useState<string[]>([]);
    
    // State for multi-selection
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentioning, setIsMentioning] = useState(false);
    const [mentionPopupPosition, setMentionPopupPosition] = useState({ top: 0, left: 0 });
    const mentionStartPositionRef = useRef<number | null>(null);

    const handleCreateSalesTicket = useCallback(async (mapType: 'GTA V' | 'GTA IV') => {
        if (!userProfile || !db) {
            toast({ title: "Ação Necessária", description: "Faça login para iniciar uma consulta.", variant: "destructive" });
            return;
        }
        setIsCreatingTicket(true);
        try {
            const ticketName = `venda-${userProfile.displayName.toLowerCase().replace(/\s/g, '-')}`;
            
            const settingsDocRef = doc(db, 'settings', 'site_config');
            const settingsSnap = await getDoc(settingsDocRef);
            const salesBotEnabled = settingsSnap.exists() && settingsSnap.data().isSalesBotEnabled;

            const newChannelRef = await addDoc(collection(db, 'chatChannels'), {
                name: ticketName,
                categoryId: SALES_CONSULTATION_CATEGORY_ID,
                isPrivate: true,
                isClosed: false,
                allowedUsers: [userProfile.uid],
                createdAt: serverTimestamp(),
                initialInterest: mapType,
            });

            if (salesBotEnabled) {
                 await addDoc(collection(newChannelRef, 'messages'), {
                    text: `Olá! Vi seu interesse no mapa do ${mapType}. Selecione uma das opções abaixo ou descreva sua necessidade.`,
                    user: { uid: 'bot', name: 'Assistente de Vendas', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true },
                    createdAt: serverTimestamp(),
                    isBotMessage: true,
                    messageType: 'sales_pitch',
                });
            } else {
                 await addDoc(collection(newChannelRef, 'messages'), {
                    text: `Olá ${userProfile.displayName}! Bem-vindo à sua consulta de encomenda para o mapa ${mapType}. Um administrador entrará em contato em breve para discutir os detalhes.`,
                    user: { uid: 'bot', name: 'Assistente de Vendas', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true },
                    createdAt: serverTimestamp(),
                    isBotMessage: true,
                 });
            }
            
            toast({ title: "Consulta Iniciada!", description: `Um canal privado foi criado para sua encomenda.`, className: "bg-green-600 text-white" });
            setActiveChannelId(newChannelRef.id);
            onSalesTicketHandled();
        } catch (error) {
            console.error("Error creating sales ticket:", error);
            toast({ title: "Erro", description: "Não foi possível iniciar a consulta.", variant: "destructive" });
        } finally {
            setIsCreatingTicket(false);
        }
    }, [userProfile, toast, setActiveChannelId, onSalesTicketHandled]);


    useEffect(() => {
        if (triggerSalesTicket) {
             handleCreateSalesTicket('GTA V');
        }
    }, [triggerSalesTicket, handleCreateSalesTicket]);

    useEffect(() => {
        if (!db) return;
        const fetchUsers = async () => {
            try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                setAllUsers(usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
            } catch (error) { console.error("Error fetching users for mentions:", error); }
        };
        fetchUsers();
    }, []);
    
    useEffect(() => {
        if (!db || !userProfile) return;
        setIsLoading(true);
    
        let unsubscribers: Unsubscribe[] = [];

        const fetchAllUserChannels = async () => {
            let combinedChannels: ChatChannel[] = [];
            const publicChannelsQuery = query(collection(db, 'chatChannels'), where("isPrivate", "==", false));
            const privateChannelsQuery = query(collection(db, 'chatChannels'), where('isPrivate', '==', true), where('allowedUsers', 'array-contains', userProfile.uid));

            try {
                const [publicSnapshot, privateSnapshot] = await Promise.all([
                    getDocs(publicChannelsQuery),
                    getDocs(privateChannelsQuery)
                ]);

                const publicChannels = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as ChatChannel }));
                const privateChannels = privateSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as ChatChannel }));
                
                const channelMap = new Map();
                [...publicChannels, ...privateChannels].forEach(channel => channelMap.set(channel.id, channel));

                if (userProfile.isAdmin) {
                    const allAdminChannelsQuery = query(collection(db, 'chatChannels'));
                    const adminSnapshot = await getDocs(allAdminChannelsQuery);
                    adminSnapshot.docs.forEach(doc => channelMap.set(doc.id, { id: doc.id, ...doc.data() as ChatChannel }));
                }

                combinedChannels = Array.from(channelMap.values());
                setChannels(combinedChannels);
            } catch (error) {
                console.error("Error fetching channels:", error);
            }
        };

        fetchAllUserChannels();
    
        const unsubCategories = onSnapshot(query(collection(db, 'chatCategories'), orderBy('order', 'asc')), (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatCategory[]);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching categories:", error);
            toast({ title: "Erro", description: "Não foi possível carregar as categorias.", variant: "destructive" });
             setIsLoading(false);
        });
        unsubscribers.push(unsubCategories);

        return () => unsubscribers.forEach(unsub => unsub());
    }, [toast, userProfile]);
    
     const { visibleCategories, visibleChannels } = useMemo(() => {
        if (!userProfile) return { visibleCategories: [], visibleChannels: [] };

        const allVisibleChannels = [serverInfoChannel, supportChannel, ...channels].filter(channel => {
            if (userProfile.isAdmin) return true;
            if (channel.isPrivate) return channel.allowedUsers?.includes(userProfile.uid);
            const parentCategory = categories.find(c => c.id === channel.categoryId);
            if (!parentCategory) return true;
            if (parentCategory.allowedRanks && parentCategory.allowedRanks.length > 0) {
                 return parentCategory.allowedRanks.includes(userProfile.rank || '');
            }
            return true;
        });

        const hasChannelInCategory = (categoryId: string) => allVisibleChannels.some(c => c.categoryId === categoryId);
        const hasOpenTicket = hasChannelInCategory(TICKETS_CATEGORY_ID);

        const allPossibleCategories = [ serverInfoCategory, supportCategory, ...categories, 
            { id: SALES_CONSULTATION_CATEGORY_ID, name: 'Consultas de Venda', order: -8, createdAt: new Timestamp(0,0), allowedRanks: [] },
            { id: TICKETS_CATEGORY_ID, name: 'Tickets', order: -7, createdAt: new Timestamp(0, 0), allowedRanks: [] },
            { id: TICKETS_ARCHIVED_CATEGORY_ID, name: 'Tickets Finalizados', order: 99, createdAt: new Timestamp(0,0), allowedRanks: [] }
        ];

        const finalVisibleCategories = allPossibleCategories.filter(cat => {
            if (cat.id === TICKETS_ARCHIVED_CATEGORY_ID) {
                return userProfile.isAdmin && hasChannelInCategory(cat.id);
            }
            if (cat.id === SUPPORT_CATEGORY_ID) return !hasOpenTicket;
            return hasChannelInCategory(cat.id);
        }).sort((a,b) => a.order - b.order);
        
        return { visibleCategories: finalVisibleCategories, visibleChannels: allVisibleChannels };

    }, [channels, categories, userProfile]);

    useEffect(() => {
        if (isLoading) return;
        const currentActiveChannel = visibleChannels.find(c => c.id === activeChannelId);
        if (currentActiveChannel) setActiveChannel(currentActiveChannel);
        else if (visibleChannels.length > 0) setActiveChannelId(serverInfoChannel.id);
        else setActiveChannel(null);
    }, [activeChannelId, visibleChannels, isLoading, setActiveChannelId]);

  useEffect(() => {
    if (activeChannel?.id === SUPPORT_CHANNEL_ID) { setMessages([supportBotMessage]); return; }
    if (activeChannel?.id === SERVER_INFO_CHANNEL_ID) { setMessages([serverInfoMessage]); return; }
    if (!db || !activeChannel) { setMessages([]); return; }

    const unsubscribe = onSnapshot(query(collection(db, 'chatChannels', activeChannel.id, 'messages'), orderBy('createdAt', 'asc')), (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as mensagens.", variant: "destructive"});
    });
    return () => unsubscribe();
  }, [activeChannel, toast]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

   const handleBotActionClick = async (actionId: string, customData?: any) => {
        if (actionId === 'create-ticket') {
            await handleCreateTicket();
        } else if (actionId === 'close-ticket' && activeChannel) {
            setItemToManage({ type: 'channel', action: 'close', item: activeChannel });
        } else if (actionId === 'express_interest' && customData?.productName && userProfile && activeChannel) {
             const interestMessage = `Olá, tenho interesse na conversão do mapa ${customData.productName}. Poderiam me passar mais detalhes sobre o processo e orçamento?`;
             await addDoc(collection(db, 'chatChannels', activeChannel.id, 'messages'), {
                text: interestMessage,
                user: { uid: userProfile.uid, name: userProfile.displayName, avatar: userProfile.photoURL, rank: userProfile.rank, isAdmin: userProfile.isAdmin },
                createdAt: serverTimestamp(), replyTo: null, reactions: {},
            });
        }
    };

    const handleCreateTicket = async () => {
        if (!userProfile || !db) { toast({ title: "Erro", description: "Você precisa estar logado para criar um ticket.", variant: "destructive" }); return; }
        setIsCreatingTicket(true);
        try {
            const ticketsQuery = query(collection(db, 'chatChannels'), where('allowedUsers', 'array-contains', userProfile.uid), where('categoryId', '==', TICKETS_CATEGORY_ID));
            const existingTickets = await getDocs(ticketsQuery);
            if (!existingTickets.empty) {
                toast({ title: "Ticket Existente", description: "Você já possui um ticket de suporte aberto.", variant: "default", className: "bg-yellow-500 border-yellow-500 text-black" });
                setActiveChannelId(existingTickets.docs[0].id);
                return;
            }

            const ticketName = `ticket-${userProfile.displayName.toLowerCase().replace(/\s/g, '-')}`;
            const newChannelRef = await addDoc(collection(db, 'chatChannels'), {
                name: ticketName, categoryId: TICKETS_CATEGORY_ID, isPrivate: true, isClosed: false, allowedUsers: [userProfile.uid], createdAt: serverTimestamp(),
            });
            await addDoc(collection(newChannelRef, 'messages'), {
                 text: `Olá ${userProfile.displayName}! Descreva seu problema em detalhes e um administrador irá respondê-lo em breve. Quando o problema for resolvido, você ou um administrador podem fechar este ticket.`,
                 user: { uid: 'bot', name: 'STUDIO PECC', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true },
                 createdAt: serverTimestamp(), isBotMessage: true, actions: [{ text: 'Fechar Ticket', actionId: 'close-ticket' }],
            });
            toast({ title: "Ticket Criado!", description: `O canal #${ticketName} foi criado.`, className: "bg-green-600 text-white" });
            setActiveChannelId(newChannelRef.id);
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast({ title: "Erro ao Criar Ticket", description: "Não foi possível criar seu ticket.", variant: "destructive" });
        } finally {
            setIsCreatingTicket(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !userProfile || !db || !activeChannel || [SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(activeChannel.id)) return;
        if (activeChannel.isClosed) { toast({ title: "Ticket Fechado", description: "Não é possível enviar mensagens em um ticket finalizado.", variant: "destructive"}); return; }
        try {
          await addDoc(collection(db, 'chatChannels', activeChannel.id, 'messages'), {
            text: newMessage,
            user: { uid: userProfile.uid, name: userProfile.displayName, avatar: userProfile.photoURL, rank: userProfile.rank, isAdmin: userProfile.isAdmin },
            createdAt: serverTimestamp(),
            replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text, authorName: replyingTo.user.name } : null,
            reactions: {},
          });
          setNewMessage(''); setReplyingTo(null);
        } catch (error) {
          console.error("Error sending message:", error);
          toast({ title: "Erro", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!db || !activeChannel || [SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(activeChannel.id)) return;
        if (!userProfile?.isAdmin && messages.find(m => m.id === messageId)?.user.uid !== userProfile?.uid) {
            toast({ title: "Acesso Negado", description: "Você não tem permissão para excluir esta mensagem.", variant: "destructive" }); return;
        }
        await deleteDoc(doc(db, 'chatChannels', activeChannel.id, 'messages', messageId));
        toast({ title: "Mensagem Excluída", variant: 'default' });
    };

    const handleReaction = async (message: ChatMessage, emoji: string) => {
        if (!userProfile || !db || !activeChannel || message.isBotMessage) return;
        const messageRef = doc(db, 'chatChannels', activeChannel.id, 'messages', message.id);
        const usersWhoReacted = message.reactions?.[emoji] || [];
        await updateDoc(messageRef, { [`reactions.${emoji}`]: usersWhoReacted.includes(userProfile.uid) ? arrayRemove(userProfile.uid) : arrayUnion(userProfile.uid) });
    };

    const handleConfirmManagementAction = async () => {
        if (!itemToManage || !db) return;
        const { type, action, item } = itemToManage;
        try {
            if (type === 'channel') {
                const channel = item as ChatChannel;
                if (action === 'delete') {
                    await deleteDoc(doc(db, 'chatChannels', channel.id));
                    if (activeChannel?.id === channel.id) setActiveChannelId(supportChannel.id);
                    toast({ title: "Canal Excluído", description: `O canal #${channel.name} foi removido.` });
                } else if (action === 'close') {
                    const channelRef = doc(db, 'chatChannels', channel.id);
                    await updateDoc(channelRef, { isClosed: true, name: `✅-finalizado-${channel.name}`, categoryId: TICKETS_ARCHIVED_CATEGORY_ID });
                     await addDoc(collection(channelRef, 'messages'), { text: `Este ticket foi encerrado e arquivado.`, user: { uid: 'bot', name: 'STUDIO PECC', avatar: 'https://i.imgur.com/sXliRZl.png', rank: 'admin', isAdmin: true }, createdAt: serverTimestamp(), isBotMessage: true });
                    toast({ title: "Ticket Encerrado", description: `O ticket foi finalizado e arquivado.` });
                    setActiveChannelId(supportChannel.id);
                }
            } else if (type === 'category') {
                const category = item as ChatCategory;
                const batch = writeBatch(db);
                channels.filter(c => c.categoryId === category.id).forEach(c => {
                    batch.delete(doc(db, 'chatChannels', c.id));
                     if (activeChannel?.categoryId === c.categoryId) setActiveChannelId(supportChannel.id);
                });
                batch.delete(doc(db, 'chatCategories', category.id));
                await batch.commit();
                toast({ title: "Categoria Excluída", description: `A categoria ${category.name} e seus canais foram removidos.` });
            } else if (type === 'multichannel' && action === 'delete') {
                const channelsToDelete = item as ChatChannel[];
                const batch = writeBatch(db);
                channelsToDelete.forEach(c => {
                    batch.delete(doc(db, 'chatChannels', c.id));
                });
                await batch.commit();
                toast({ title: `${channelsToDelete.length} canais excluídos`, description: "Os canais selecionados foram removidos." });
                if (selectedChannels.includes(activeChannelId || '')) {
                    setActiveChannelId(serverInfoChannel.id);
                }
                setSelectedChannels([]);
            }
        } catch (error) {
             console.error(`Error during '${action}' on ${type}:`, error);
            toast({ title: "Erro", description: `Não foi possível concluir a ação.`, variant: "destructive" });
        } finally {
            setItemToManage(null);
        }
    };
    
    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text).then(() => toast({ title: "Texto copiado!" }));
    };
    const handleReplyClick = (message: ChatMessage) => { 
        if(!message.isBotMessage){ setReplyingTo(message); inputRef.current?.focus(); }
    };
    const formatDate = (timestamp: Timestamp | null | undefined): string => {
        return timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    };
    const handleScrollToMessage = (messageId: string) => {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-primary/10', 'transition-all', 'duration-500');
            setTimeout(() => element.classList.remove('bg-primary/10'), 2000);
        }
    };
    const handleOpenChannelModal = (categoryId?: string, channel?: ChatChannel) => {
        setEditingChannel(channel ? { categoryId: channel.categoryId, channel } : { categoryId: categoryId || '' });
        setChannelName(channel?.name || '');
        setSelectedCategoryId(channel?.categoryId || categoryId || '');
    };
    const handleOpenCategoryModal = (category?: ChatCategory) => { 
        setEditingCategory(category || null); 
        setNewCategoryName(category?.name || ''); 
        setNewCategoryOrder(category?.order || categories.length + 1); 
        setAllowedRanks(category?.allowedRanks || []); 
    };
    const handleSaveChannel = async () => {
        if (!channelName.trim() || !selectedCategoryId || !db) return;
        try {
            if (editingChannel?.channel) {
                await updateDoc(doc(db, 'chatChannels', editingChannel.channel.id), { name: channelName.trim(), categoryId: selectedCategoryId });
                toast({ title: "Canal Atualizado!" });
            } else {
                await addDoc(collection(db, 'chatChannels'), { name: channelName.trim(), categoryId: selectedCategoryId, isPrivate: false, allowedUsers: [], createdAt: serverTimestamp() });
                toast({ title: "Canal Criado!" });
            }
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível salvar o canal.", variant: "destructive" });
        } finally {
            setEditingChannel(null);
            setChannelName('');
        }
    };
    const handleSaveCategory = async () => {
        if (!newCategoryName.trim() || !db) return;
        try {
            if (editingCategory) {
                await updateDoc(doc(db, 'chatCategories', editingCategory.id), { name: newCategoryName.trim(), order: newCategoryOrder, allowedRanks });
                toast({ title: "Categoria Atualizada!" });
            } else {
                await addDoc(collection(db, 'chatCategories'), { name: newCategoryName.trim(), order: newCategoryOrder, createdAt: serverTimestamp(), allowedRanks });
                toast({ title: "Categoria Criada!" });
            }
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível salvar a categoria.", variant: "destructive" });
        } finally {
            setEditingCategory(null);
            setNewCategoryName('');
            setNewCategoryOrder(0);
            setAllowedRanks([]);
        }
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart || 0;
        const atIndex = value.lastIndexOf('@', cursorPosition - 1);
        if (atIndex !== -1) {
            const query = value.substring(atIndex + 1, cursorPosition);
            if (!/\s/.test(query)) {
                setIsMentioning(true);
                setMentionQuery(query);
                mentionStartPositionRef.current = atIndex;
                const rect = e.target.getBoundingClientRect();
                setMentionPopupPosition({ top: rect.top - 200, left: rect.left });
            } else {
                setIsMentioning(false);
            }
        } else {
            setIsMentioning(false);
        }
        setNewMessage(value);
    };
    const handleMentionSelect = (user: UserProfile) => {
        if (mentionStartPositionRef.current === null) return;
        const before = newMessage.substring(0, mentionStartPositionRef.current);
        const after = newMessage.substring(inputRef.current?.selectionStart || 0);
        setNewMessage(`${before}@${user.displayName} ${after}`);
        setIsMentioning(false);
        setMentionQuery('');
        mentionStartPositionRef.current = null;
        inputRef.current?.focus();
    };
    const filteredUsersForMention = allUsers.filter(user => user.displayName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);
    const RankIcon = ({ rank }: { rank?: string }) => { 
        const Icon = rank ? rankIcons[rank] : null; 
        if (!Icon) return null; 
        return <Icon className="h-4 w-4 ml-1.5" />;
    };

    const handleChannelClick = (e: React.MouseEvent, channelId: string) => {
        if (e.ctrlKey) {
            setSelectedChannels(prev =>
                prev.includes(channelId)
                    ? prev.filter(id => id !== channelId)
                    : [...prev, channelId]
            );
        } else {
            setActiveChannelId(channelId);
            setSelectedChannels([]);
        }
    };

    const handleDeleteSelectedChannels = () => {
        const channelsToDelete = channels.filter(c => selectedChannels.includes(c.id));
        if (channelsToDelete.length > 0) {
            setItemToManage({ type: 'multichannel', action: 'delete', item: channelsToDelete });
        }
    };

  return (
    <div className="flex w-full bg-secondary/40 rounded-lg border border-border h-[calc(100vh-var(--header-height)-4rem)]">
      {/* Channel List Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-card/50 p-2 flex flex-col">
         <header className="flex items-center justify-between p-2 mb-1">
            <h2 className="text-md font-semibold text-foreground">Canais</h2>
            {userProfile?.isAdmin && (
                 <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button></PopoverTrigger>
                    <PopoverContent className="w-40 p-1"><Button variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => handleOpenChannelModal()}>Criar Canal</Button><Button variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => handleOpenCategoryModal()}>Criar Categoria</Button></PopoverContent>
                </Popover>
            )}
        </header>
        {selectedChannels.length > 0 && userProfile?.isAdmin && (
                <div className="px-2 py-1 mb-2">
                    <Button variant="destructive" size="sm" className="w-full" onClick={handleDeleteSelectedChannels}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir ({selectedChannels.length})
                    </Button>
                </div>
        )}
        <ScrollArea className="flex-1">
          {isLoading ? <div className="p-2 space-y-2"><div className="h-8 bg-muted rounded-md animate-pulse"></div><div className="h-6 bg-muted rounded-md animate-pulse ml-4"></div></div> : (
            <Accordion type="multiple" defaultValue={visibleCategories.map(c => c.id)} className="w-full">
                {visibleCategories.map(category => (
                    <AccordionItem value={category.id} key={category.id} className="border-b-0 group/category">
                        <ContextMenu><ContextMenuTrigger disabled={!userProfile?.isAdmin || [SERVER_INFO_CATEGORY_ID, SUPPORT_CATEGORY_ID, TICKETS_CATEGORY_ID, SALES_CONSULTATION_CATEGORY_ID, TICKETS_ARCHIVED_CATEGORY_ID].includes(category.id)}>
                            <AccordionTrigger className="flex-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground py-1 px-2 rounded-md">{category.name}</AccordionTrigger>
                        </ContextMenuTrigger>
                        <ContextMenuContent><ContextMenuItem onSelect={() => handleOpenCategoryModal(category)}>Editar Categoria</ContextMenuItem><ContextMenuItem onSelect={() => setItemToManage({ type: 'category', action: 'delete', item: category })} className="text-destructive">Excluir Categoria</ContextMenuItem></ContextMenuContent></ContextMenu>
                        <AccordionContent className="pl-2 pb-1"><nav className="space-y-1">
                            {visibleChannels.filter(c => c.categoryId === category.id).map(channel => (
                                <ContextMenu key={channel.id}>
                                    <ContextMenuTrigger disabled={!userProfile?.isAdmin || [SERVER_INFO_CHANNEL_ID, SUPPORT_CHANNEL_ID].includes(channel.id) || channel.isClosed}>
                                        <Button 
                                            variant="ghost" 
                                            onClick={(e) => handleChannelClick(e, channel.id)}
                                            className={cn('w-full justify-start text-muted-foreground', 
                                                activeChannel?.id === channel.id && 'bg-accent text-accent-foreground',
                                                selectedChannels.includes(channel.id) && 'bg-primary/20 text-primary-foreground'
                                            )}
                                        >
                                            {channel.isPrivate ? <Lock className="mr-2 h-4 w-4" /> : channel.categoryId === SERVER_INFO_CATEGORY_ID ? <BookOpen className="mr-2 h-4 w-4" /> : <Hash className="mr-2 h-4 w-4" />}
                                            <span className="truncate">{channel.name}</span>
                                        </Button>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent><ContextMenuItem onSelect={() => handleOpenChannelModal(channel.categoryId, channel)}>Editar Canal</ContextMenuItem>{![SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(channel.id) && (<ContextMenuItem onSelect={() => setItemToManage({ type: 'channel', action: 'delete', item: channel })} className="text-destructive">Excluir Canal</ContextMenuItem>)}</ContextMenuContent>
                                </ContextMenu>
                            ))}
                        </nav></AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
          )}
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center h-14 border-b border-border px-4 flex-shrink-0">
          {activeChannel?.isPrivate ? <Lock className="h-5 w-5 text-muted-foreground" /> : activeChannel?.categoryId === SERVER_INFO_CATEGORY_ID ? <BookOpen className="h-5 w-5 text-muted-foreground" /> : <Hash className="h-5 w-5 text-muted-foreground" />}
          <h1 className="text-lg font-semibold text-foreground ml-1 truncate">{activeChannel?.name || 'Selecione um canal'}</h1>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col relative">
            {isMentioning && filteredUsersForMention.length > 0 && (
                <Card className="absolute z-20 w-72 rounded-md border bg-popover text-popover-foreground shadow-md" style={{ bottom: '80px', left: '20px' }}>
                    <CardHeader className="p-2"><CardTitle className="text-sm font-medium">Mencionar Usuário</CardTitle></CardHeader>
                    <CardContent className="p-0"><ScrollArea className="h-40">{filteredUsersForMention.map(user => (<button key={user.uid} className="w-full text-left flex items-center gap-2 p-2 hover:bg-accent" onClick={() => handleMentionSelect(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.photoURL || undefined} /><AvatarFallback>{user.displayName.substring(0, 2)}</AvatarFallback></Avatar><span className="text-sm">{user.displayName}</span></button>))}</ScrollArea></CardContent>
                </Card>
            )}
             <ScrollArea className="flex-1" ref={scrollAreaRef}><div className="p-4 space-y-4 pr-4 min-h-full flex flex-col justify-end">
              {!activeChannel ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><MessageSquareReply className="h-12 w-12 mb-4" /><p>Selecione um canal para começar a conversar.</p></div>
              : messages.length === 0 && ![SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(activeChannel.id) ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><p className="text-sm">Seja o primeiro a enviar uma mensagem em #{activeChannel.name}!</p></div>
              : (messages.map(msg => { const canDelete = userProfile?.isAdmin || userProfile?.uid === msg.user.uid; return (
                <div key={msg.id} id={`message-${msg.id}`} className="group relative flex items-start gap-3 p-2 rounded-md hover:bg-accent/5">
                 {!msg.isBotMessage && (<div className="absolute top-0 right-2 -mt-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"><div className="flex items-center gap-1 bg-card border border-border rounded-md shadow-md p-1">
                    <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"><Smile className="h-4 w-4" /><span className="sr-only">Adicionar Reação</span></Button></PopoverTrigger><PopoverContent className="w-auto p-1 bg-card border-border"><div className="flex gap-1">{EMOJI_LIST.map(emoji => (<Button key={emoji} variant="ghost" size="icon" className="h-7 w-7 text-lg rounded-full" onClick={() => handleReaction(msg, emoji)}>{emoji}</Button>))}</div></PopoverContent></Popover>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleReplyClick(msg)}><MessageSquareReply className="h-4 w-4" /><span className="sr-only">Responder</span></Button>
                    <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Mais</span></Button></PopoverTrigger>
                        <PopoverContent align="end" className="w-40 p-1 bg-card border-border">
                            <Button variant="ghost" className="w-full justify-start h-8 text-sm" onSelect={() => handleReplyClick(msg)}><MessageSquareReply className="mr-2 h-4 w-4" />Responder</Button>
                            <Button variant="ghost" className="w-full justify-start h-8 text-sm" onClick={() => handleCopyText(msg.text)}><CopyIcon className="mr-2 h-4 w-4" />Copiar Texto</Button>
                            {canDelete && (<><hr className="my-1 border-border" /><Button variant="ghost" className="w-full justify-start h-8 text-sm text-destructive hover:text-destructive" onClick={() => handleDeleteMessage(msg.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></>)}
                        </PopoverContent>
                    </Popover>
                </div></div>)}
                <Avatar className="h-10 w-10 border"><AvatarImage src={msg.user.avatar || undefined} /><AvatarFallback>{msg.user.name ? msg.user.name.substring(0, 2).toUpperCase() : <UserCircle />}</AvatarFallback></Avatar>
                <div className="flex-1">
                    {msg.replyTo && (<button onClick={() => handleScrollToMessage(msg.replyTo.messageId)} className="w-full text-left mb-1 text-xs text-muted-foreground flex items-center hover:bg-secondary p-1 rounded-md"><MessageSquareReply className="h-3 w-3 mr-1.5 flex-shrink-0" />Respondendo a <span className="font-semibold text-foreground/80 mx-1">{msg.replyTo.authorName}</span>:<p className="ml-1 italic truncate max-w-[200px]">"{msg.replyTo.text}"</p></button>)}
                    <div className="flex items-baseline gap-2">
                       {msg.isBotMessage ? <div className="font-semibold text-foreground flex items-center gap-1.5"><Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">BOT</Badge>{msg.user.name}</div>
                       : msg.user.isAdmin ? <div className="font-semibold text-foreground flex items-center"><Badge variant="default" className="bg-yellow-400 hover:bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 mr-1.5">ADMIN</Badge>{msg.user.name}<Crown className="w-4 h-4 ml-1.5 text-yellow-500" /></div>
                       : <div className="font-semibold text-foreground flex items-center">{msg.user.name} <RankIcon rank={msg.user.rank} /></div>}
                       <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                    </div>
                    {msg.messageType === 'sales_pitch' ? (
                        <div>
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-4">{renderMessageText(msg.text)}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <Card className="overflow-hidden bg-secondary"><CardHeader className="p-0"><Image src="https://i.imgur.com/XLIbJZT.png" alt="GTA V Map" width={300} height={150} className="w-full h-24 object-cover" data-ai-hint="gta5 city" /></CardHeader><CardContent className="p-3"><h3 className="text-base font-semibold mb-1">Conversão de Mapa: GTA V</h3><p className="text-xs text-muted-foreground mb-3">Traga a vastidão e os detalhes de Los Santos para o seu servidor.</p><Button size="sm" className="w-full" onClick={() => handleBotActionClick('express_interest', { productName: 'GTA V' })}>Tenho Interesse</Button></CardContent></Card>
                                <Card className="overflow-hidden bg-secondary"><CardHeader className="p-0"><Image src="https://i.imgur.com/wLdG12M.jpeg" alt="GTA IV Map" width={300} height={150} className="w-full h-24 object-cover" data-ai-hint="gta4 city" /></CardHeader><CardContent className="p-3"><h3 className="text-base font-semibold mb-1">Conversão de Mapa: GTA IV</h3><p className="text-xs text-muted-foreground mb-3">A atmosfera única e a complexidade de Liberty City em seu projeto.</p><Button size="sm" className="w-full" onClick={() => handleBotActionClick('express_interest', { productName: 'GTA IV' })}>Tenho Interesse</Button></CardContent></Card>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Precisa de outro mapa? Descreva sua necessidade e faremos um orçamento. Todos os serviços possuem garantia de satisfação e política de reembolso.</p>
                        </div>
                    ) : <div className="text-sm text-foreground/90 whitespace-pre-wrap">{renderMessageText(msg.text)}</div>}
                     {msg.actions && msg.actions.length > 0 && !activeChannel?.isClosed && (
                         <div className="mt-2 flex gap-2">{msg.actions.map(action => (<Button key={action.actionId} size="sm" onClick={() => handleBotActionClick(action.actionId)} disabled={isCreatingTicket}>{action.actionId === 'create-ticket' && (isCreatingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TicketIcon className="mr-2 h-4 w-4" />)}{action.actionId === 'close-ticket' && <Trash2 className="mr-2 h-4 w-4" />}{isCreatingTicket && action.actionId === 'create-ticket' ? 'Criando...' : action.text}</Button>))}</div>
                     )}
                     {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                       <div className="mt-1 flex flex-wrap gap-1">{Object.entries(msg.reactions).map(([emoji, uids]) => { if (uids.length === 0) return null; const userHasReacted = userProfile && uids.includes(userProfile.uid); return (<Button key={emoji} variant="outline" size="sm" className={cn("h-auto px-1.5 py-0.5 text-xs rounded-full border-accent/50 bg-accent/20 hover:bg-accent/40", userHasReacted && "border-primary bg-primary/20")} onClick={() => handleReaction(msg, emoji)}><span className="text-sm mr-1">{emoji}</span><span className="font-mono text-xs">{uids.length}</span></Button>);})}</div>
                     )}
                </div>
              </div>);
              }))}
            </div></ScrollArea>
        </div>

        <div className="p-4 border-t border-border mt-auto flex-shrink-0">
            {replyingTo && (<div className="bg-secondary/80 text-xs text-muted-foreground p-2 rounded-t-md flex justify-between items-center animate-in fade-in-20"><div className="truncate">Respondendo a <span className="font-semibold text-foreground/80">{replyingTo.user.name}</span>:<span className="italic ml-1">"{replyingTo.text}"</span></div><Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={() => setReplyingTo(null)}><X className="h-3 w-3" /><span className="sr-only">Cancelar Resposta</span></Button></div>)}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input ref={inputRef} value={newMessage} onChange={handleInputChange} placeholder={activeChannel ? `Conversar em #${activeChannel.name}` : 'Selecione um canal para conversar'} className={cn("flex-1 bg-input", replyingTo && "rounded-t-none")} autoComplete="off" disabled={!userProfile || !activeChannel || [SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(activeChannel.id) || activeChannel.isClosed} />
                <Button type="submit" size="icon" className="flex-shrink-0" disabled={!userProfile || !activeChannel || newMessage.trim() === '' || [SUPPORT_CHANNEL_ID, SERVER_INFO_CHANNEL_ID].includes(activeChannel.id) || activeChannel.isClosed}><Send className="h-4 w-4" /></Button>
            </form>
        </div>
      </div>

       {/* Modals */}
       <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}><DialogContent><DialogHeader><DialogTitle>{editingChannel?.channel ? 'Editar Canal' : 'Criar Novo Canal'}</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="channel-name" className="text-right">Nome</Label><Input id="channel-name" value={channelName} onChange={(e) => setChannelName(e.target.value)} className="col-span-3" placeholder="ex: geral"/></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="channel-category" className="text-right">Categoria</Label><Select onValueChange={setSelectedCategoryId} value={selectedCategoryId}><SelectTrigger id="channel-category" className="col-span-3"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger><SelectContent>{categories.filter(c => ![SERVER_INFO_CATEGORY_ID, SUPPORT_CATEGORY_ID, TICKETS_CATEGORY_ID, TICKETS_ARCHIVED_CATEGORY_ID, SALES_CONSULTATION_CATEGORY_ID].includes(c.id)).map(category => (<SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button type="button" variant="secondary" onClick={() => setEditingChannel(null)}>Cancelar</Button><Button type="button" onClick={handleSaveChannel}>Salvar</Button></DialogFooter></DialogContent></Dialog>
       <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}><DialogContent><DialogHeader><DialogTitle>{editingCategory ? 'Editar Categoria' : 'Criar Nova Categoria'}</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="category-name" className="text-right">Nome</Label><Input id="category-name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="col-span-3" placeholder="ex: Geral"/></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="category-order" className="text-right">Ordem</Label><Input id="category-order" type="number" value={newCategoryOrder} onChange={(e) => setNewCategoryOrder(Number(e.target.value))} className="col-span-3"/></div><div className="grid grid-cols-4 items-start gap-4"><Label className="text-right pt-2">Cargos</Label><div className="col-span-3 space-y-2"><p className="text-xs text-muted-foreground">Selecione quais cargos podem ver esta categoria. Deixe em branco para ser pública.</p>{rankKeys.map((rankKey) => (<div key={rankKey} className="flex items-center space-x-2"><Checkbox id={`rank-${rankKey}`} checked={allowedRanks.includes(rankKey)} onCheckedChange={(checked) => { setAllowedRanks(prev => checked ? [...prev, rankKey] : prev.filter(r => r !== rankKey)); }} /><label htmlFor={`rank-${rankKey}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{ranks[rankKey]}</label></div>))}</div></div></div><DialogFooter><Button type="button" variant="secondary" onClick={() => setEditingCategory(null)}>Cancelar</Button><Button type="button" onClick={handleSaveCategory}>Salvar Categoria</Button></DialogFooter></DialogContent></Dialog>
       <AlertDialog open={!!itemToManage} onOpenChange={(open) => !open && setItemToManage(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitleComponent>Confirmar Ação</AlertDialogTitleComponent>
                <AlertDialogDescription>
                    {itemToManage?.action === 'delete' && itemToManage.type === 'multichannel' && `Tem certeza que quer excluir os ${ (itemToManage.item as ChatChannel[]).length } canais selecionados? Esta ação não pode ser desfeita.`}
                    {itemToManage?.action === 'delete' && itemToManage.type !== 'multichannel' && `Tem certeza que quer excluir? Esta ação não pode ser desfeita.`}
                    {itemToManage?.action === 'close' && `Tem certeza que quer encerrar este ticket? Ele será arquivado e não poderá mais receber mensagens.`}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setItemToManage(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmManagementAction} className="bg-destructive hover:bg-destructive/90">{itemToManage?.action === 'delete' ? 'Excluir' : 'Encerrar Ticket'}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}
