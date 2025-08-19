'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, UserCircle, MessageSquareReply, X, Trash2, Copy, MoreHorizontal, ChevronLeft, LifeBuoy, Ticket, Loader2, MessageSquarePlus, Search, ShoppingCart, Hammer, Trash, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useForm } from 'react-hook-form'; // Import useForm
import { zodResolver } from '@hookform/resolvers/zod'; // Import zodResolver
import * as z from 'zod'; // Import z
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Skeleton } from '@/components/ui/skeleton';


import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/page/home-client-page';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDocs, where, or, writeBatch, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { ranks, rankIcons } from '@/config/ranks';
import { Label } from '../ui/label';

type TicketType = 'support' | 'quote' | 'purchase';

interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  userName: string;
  userId: string;
  type: TicketType;
  createdAt: Timestamp;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  relatedContractId?: string; // For cancellation tickets
  relatedTicketId?: string; // For cancellation tickets
}

// Update ChatMessage to include full contract data
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
  isContract?: boolean;
  contractData?: { // Changed from simple fields to a structured object
    clientName: string;
    clientCpf: string;
    object: string; // "Objeto do Contrato"
    deadline: string; // "Prazo"
    price: string; // "Valor"
  };
  contractStatus?: 'pending' | 'signed' | 'cancelled';
  isCancellation?: boolean;
  cancellationData?: {
      originalTicketId: string;
      originalContractId: string;
  };
  cancellationStatus?: 'pending' | 'confirmed';
}


interface SupportContentProps {
  userProfile: UserProfile | null;
  serviceRequest: { type: 'quote' | 'purchase'; details: string } | null;
  onServiceRequestHandled: () => void;
}

// Zod schema for the contract generation form
const contractFormSchema = z.object({
    clientName: z.string().min(3, "Nome do cliente é obrigatório."),
    clientCpf: z.string().min(11, "CPF deve ter pelo menos 11 dígitos."),
    object: z.string().min(10, "O objeto do contrato é obrigatório."),
    deadline: z.string().min(3, "O prazo é obrigatório."),
    price: z.string().min(1, "O valor é obrigatório."),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

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


export default function SupportContent({ userProfile, serviceRequest, onServiceRequestHandled }: SupportContentProps) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isClearing, setIsClearing] = useState(false); // State for clearing all tickets
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [ticketToDelete, setTicketToDelete] = useState<SupportTicket | null>(null);
    const [filter, setFilter] = useState<'all' | 'support' | 'quote' | 'purchase'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [signingContract, setSigningContract] = useState<{ messageId: string } | null>(null);
    const [cancellingContract, setCancellingContract] = useState<{ messageId: string } | null>(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [isContractFormOpen, setIsContractFormOpen] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const isCreatingRef = useRef(false);

    const contractForm = useForm<ContractFormData>({
        resolver: zodResolver(contractFormSchema),
        defaultValues: {
            clientName: '',
            clientCpf: '',
            object: '',
            deadline: '',
            price: ''
        },
    });

    // Effect to handle service requests (quote or purchase)
    useEffect(() => {
        const createTicketForService = async () => {
            if (!serviceRequest || !userProfile || !db || isCreatingRef.current) return;
            
            isCreatingRef.current = true;
            setIsCreating(true);
            
            let subject = '';
            let initialMessage = '';
            let type: TicketType = 'support';

            if (serviceRequest.type === 'quote') {
                type = 'quote';
                subject = `Orçamento: ${serviceRequest.details} - ${userProfile.displayName}`;
                initialMessage = `Olá ${userProfile.displayName}! Recebemos sua solicitação de orçamento para conversão de mapa (${serviceRequest.details}). Por favor, forneça o máximo de detalhes sobre o que você precisa (links, referências, etc.) para que possamos avaliar.`;
            } else if (serviceRequest.type === 'purchase') {
                type = 'purchase';
                subject = `Compra: ${serviceRequest.details} - ${userProfile.displayName}`;
                initialMessage = `Olá! Vi que você tem interesse no produto "${serviceRequest.details}". Um administrador entrará em contato em breve para finalizar a compra com você.`;
            }

            onServiceRequestHandled(); // Reset the trigger immediately

            try {
                const newTicketRef = await addDoc(collection(db, 'supportTickets'), {
                    subject,
                    status: 'open',
                    userId: userProfile.uid,
                    userName: userProfile.displayName,
                    type,
                    createdAt: serverTimestamp(),
                });

                await addDoc(collection(newTicketRef, 'messages'), {
                    text: initialMessage,
                    user: { uid: 'bot', name: 'Assistente', avatar: 'https://i.imgur.com/sXliRZl.png', isAdmin: true },
                    createdAt: serverTimestamp(),
                    isBotMessage: true,
                });

                toast({ title: "Ticket Criado!", description: `Seu ticket de ${type === 'quote' ? 'orçamento' : 'compra'} foi aberto.`, className: "bg-green-600 text-white" });
                const newTicketData = { id: newTicketRef.id, subject, status: 'open' as const, userId: userProfile.uid, userName: userProfile.displayName, type, createdAt: new Timestamp(Date.now() / 1000, 0) };
                setActiveTicket(newTicketData);
            } catch (error) {
                 console.error("Error creating service ticket:", error);
                 toast({ title: "Erro", description: "Não foi possível criar seu ticket.", variant: "destructive" });
            } finally {
                setIsCreating(false);
                isCreatingRef.current = false;
            }
        };

        createTicketForService();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceRequest, userProfile]);


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
    
    const handleCreateGenericTicket = async () => {
        if (!userProfile || !db || isCreating) {
            if(!userProfile) toast({ title: "Ação Necessária", description: "Faça login para criar um ticket.", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const subject = `Ticket de Suporte - ${userProfile.displayName}`;
            const initialMessage = `Olá ${userProfile.displayName}! Descreva seu problema em detalhes e um administrador irá respondê-lo em breve.`;
            const newTicketRef = await addDoc(collection(db, 'supportTickets'), {
                subject,
                status: 'open',
                userId: userProfile.uid,
                userName: userProfile.displayName,
                type: 'support',
                createdAt: serverTimestamp(),
            });

            await addDoc(collection(newTicketRef, 'messages'), {
                text: initialMessage,
                user: { uid: 'bot', name: 'Assistente', avatar: 'https://i.imgur.com/sXliRZl.png', isAdmin: true },
                createdAt: serverTimestamp(),
                isBotMessage: true,
            });
            toast({ title: "Ticket Criado!", description: `Seu ticket foi aberto com sucesso.`, className: "bg-green-600 text-white" });
            const newTicketData = { id: newTicketRef.id, subject, status: 'open' as const, userId: userProfile.uid, userName: userProfile.displayName, type: 'support' as const, createdAt: new Timestamp(Date.now() / 1000, 0) };
            setActiveTicket(newTicketData);
        } catch (error) {
             console.error("Error creating ticket:", error);
             toast({ title: "Erro", description: "Não foi possível criar seu ticket.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    }

    // Function to generate contract text from form data
    const generateContractTextFromData = (data: ContractFormData, adminName: string) => {
        return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: ${data.clientName}, portador(a) do CPF nº ${data.clientCpf}.\nCONTRATADO: STUDIO PECC, representado por ${adminName}.\n\nOBJETO: ${data.object}\n\nPRAZO: ${data.deadline}\n\nVALOR: ${data.price}\n\nTERMOS: O CONTRATANTE declara estar ciente e de acordo com os termos de serviço e políticas da STUDIO PECC. Ao clicar em "Confirmar e Assinar", o CONTRATANTE aceita os termos deste contrato.`;
    };


    const handleCreateContract = async (values: ContractFormData) => {
        if (!userProfile?.isAdmin || !db || !activeTicket) return;

        const contractText = generateContractTextFromData(values, userProfile.displayName);
        
        await addDoc(collection(db, 'supportTickets', activeTicket.id, 'messages'), {
            text: contractText,
            user: { uid: userProfile.uid, name: userProfile.displayName, avatar: userProfile.photoURL, rank: userProfile.rank, isAdmin: true },
            createdAt: serverTimestamp(),
            isContract: true,
            contractData: values,
            contractStatus: 'pending',
        });
        
        toast({ title: "Contrato Gerado", description: "O contrato foi enviado no chat para assinatura do cliente.", className: "bg-blue-500 text-white" });
        setIsContractFormOpen(false);
        contractForm.reset();
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !userProfile || !db || !activeTicket || activeTicket.status === 'closed') return;

        // Admin commands
        if (userProfile.isAdmin) {
             if (newMessage.startsWith('/cancelar')) {
                // Check if the current ticket is a cancellation request ticket
                if (!activeTicket.relatedContractId || !activeTicket.relatedTicketId) {
                    toast({ title: "Comando Inválido", description: "Este comando só pode ser usado em um ticket de solicitação de cancelamento.", variant: "destructive" });
                    return;
                }

                // Fetch the original contract message to confirm it exists
                const originalContractMessageRef = doc(db, 'supportTickets', activeTicket.relatedTicketId, 'messages', activeTicket.relatedContractId);
                const originalContractSnap = await getDoc(originalContractMessageRef);

                if (!originalContractSnap.exists()) {
                    toast({ title: "Erro Interno", description: "O contrato original associado a este ticket não foi encontrado.", variant: "destructive" });
                    return;
                }

                const cancellationText = `O administrador iniciou o processo de cancelamento do contrato associado a este ticket. Para confirmar o cancelamento, por favor, clique no botão abaixo.`;
                await addDoc(collection(db, 'supportTickets', activeTicket.id, 'messages'), {
                    text: cancellationText,
                    user: { uid: userProfile.uid, name: userProfile.displayName, avatar: userProfile.photoURL, rank: userProfile.rank, isAdmin: true },
                    createdAt: serverTimestamp(),
                    isCancellation: true,
                    cancellationData: {
                        originalTicketId: activeTicket.relatedTicketId,
                        originalContractId: activeTicket.relatedContractId,
                    },
                    cancellationStatus: 'pending',
                });
                setNewMessage('');
                return;
            }
        }
        
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
    
    const handleSignContract = (messageId: string) => {
        if (!userProfile || userProfile.isAdmin) return;
        setConfirmationText('');
        setSigningContract({ messageId });
    };

    const handleConfirmSignature = async () => {
        if (!signingContract || !db || !activeTicket || !userProfile || userProfile.isAdmin) return;
        const contractMessage = messages.find(m => m.id === signingContract.messageId);
        const clientNameInContract = contractMessage?.contractData?.clientName;

        if (!clientNameInContract) {
             toast({ title: "Erro Interno", description: "Não foi possível encontrar os dados do cliente.", variant: "destructive" });
             return;
        }

        if (confirmationText.trim().toLowerCase() !== clientNameInContract.trim().toLowerCase()) {
            toast({ title: "Assinatura Inválida", description: "O nome digitado não corresponde ao nome do contratante no documento.", variant: "destructive" });
            return;
        }

        const messageRef = doc(db, 'supportTickets', activeTicket.id, 'messages', signingContract.messageId);
        try {
            await updateDoc(messageRef, {
                contractStatus: 'signed',
                text: `Contrato assinado digitalmente por ${clientNameInContract}.`,
            });
            toast({ title: "Contrato Assinado!", description: "O contrato foi confirmado com sucesso.", className: "bg-green-600 text-white" });
            setSigningContract(null);
            setConfirmationText('');
        } catch (error) {
            console.error("Error signing contract:", error);
            toast({ title: "Erro", description: "Não foi possível assinar o contrato.", variant: "destructive" });
        }
    };

    const handleCancelContract = (messageId: string) => {
        if (!userProfile || userProfile.isAdmin) return;
        setConfirmationText('');
        setCancellingContract({ messageId });
    };

    const handleConfirmCancellation = async () => {
        if (!cancellingContract || !db || !activeTicket || !userProfile || userProfile.isAdmin) return;
        
        if (confirmationText.trim().toUpperCase() !== 'CANCELAR') {
            toast({ title: "Confirmação Inválida", description: "Você deve digitar 'CANCELAR' para confirmar.", variant: "destructive" });
            return;
        }

        const cancellationMessage = messages.find(m => m.id === cancellingContract.messageId);
        if (!cancellationMessage?.cancellationData) {
            toast({ title: "Erro Interno", description: "Dados de cancelamento não encontrados.", variant: "destructive" });
            return;
        }

        const { originalTicketId, originalContractId } = cancellationMessage.cancellationData;
        const cancellationMsgRef = doc(db, 'supportTickets', activeTicket.id, 'messages', cancellingContract.messageId);
        const originalContractMsgRef = doc(db, 'supportTickets', originalTicketId, 'messages', originalContractId);

        try {
            const batch = writeBatch(db);
            batch.update(cancellationMsgRef, {
                cancellationStatus: 'confirmed',
                text: 'Cancelamento confirmado pelo cliente.',
            });
            batch.update(originalContractMsgRef, { contractStatus: 'cancelled' });
            batch.update(doc(db, 'supportTickets', activeTicket.id), { status: 'closed' });

            await batch.commit();

            toast({ title: "Contrato Cancelado", description: "O contrato foi cancelado com sucesso.", className: "bg-green-600 text-white" });
            setCancellingContract(null);
            setConfirmationText('');
            setActiveTicket(null); // Go back to ticket list
        } catch (error) {
            console.error("Error confirming cancellation:", error);
            toast({ title: "Erro", description: "Não foi possível confirmar o cancelamento.", variant: "destructive" });
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

    const handleDeleteTicket = async (ticket: SupportTicket) => {
        if (!ticket || !db) return;
        try {
            await deleteDoc(doc(db, 'supportTickets', ticket.id));
            toast({ title: "Ticket Excluído", description: "O ticket e todas as suas mensagens foram removidos." });
            if (activeTicket?.id === ticket.id) {
                setActiveTicket(null);
            }
        } catch (error) {
            console.error("Error deleting ticket:", error);
            toast({ title: "Erro", description: "Não foi possível excluir o ticket.", variant: "destructive" });
        }
    };

    const handleClearAllTickets = async () => {
        if (!db || !userProfile?.isAdmin) return;
        setIsClearing(true);
        try {
            const ticketsQuery = query(collection(db, "supportTickets"));
            const querySnapshot = await getDocs(ticketsQuery);
            if (querySnapshot.empty) {
                toast({ title: "Nenhum Ticket", description: "Não há tickets para limpar.", variant: "default" });
                return;
            }
            const batch = writeBatch(db);
            querySnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            toast({ title: "Tickets Limpos!", description: "Todos os tickets de suporte foram excluídos.", className: "bg-green-600 text-white" });
        } catch (error) {
            console.error("Error clearing tickets:", error);
            toast({ title: "Erro ao Limpar", description: "Não foi possível limpar todos os tickets.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const typeMatch = filter === 'all' || ticket.type === filter;
            const searchMatch = searchTerm === '' || ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) || ticket.subject.toLowerCase().includes(searchTerm.toLowerCase());
            return typeMatch && searchMatch;
        });
    }, [tickets, filter, searchTerm]);

    const getTicketTypeBadge = (type: TicketType) => {
        switch (type) {
            case 'quote': return <Badge variant="outline" className="text-blue-500 border-blue-500">Orçamento</Badge>;
            case 'purchase': return <Badge variant="outline" className="text-green-500 border-green-500">Compra</Badge>;
            case 'support':
            default: return <Badge variant="secondary">Suporte</Badge>;
        }
    };

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
                                    {msg.isContract ? (
                                        <div className="mt-2 p-4 border border-border rounded-lg bg-secondary/50">
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                                <FileText className="h-5 w-5 text-primary" />
                                                <h4 className="font-semibold text-foreground">Contrato de Serviço</h4>
                                            </div>
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.text}</p>
                                            {msg.contractStatus === 'pending' && !userProfile?.isAdmin && (
                                                <Button size="sm" className="mt-4 bg-green-600 hover:bg-green-700" onClick={() => handleSignContract(msg.id)}>
                                                    Confirmar e Assinar
                                                </Button>
                                            )}
                                            {msg.contractStatus === 'signed' && (
                                                <div className="mt-4 flex items-center gap-2 text-green-600 border-t pt-2">
                                                    <CheckCircle className="h-5 w-5" />
                                                    <p className="font-semibold text-sm">Contrato Assinado</p>
                                                </div>
                                            )}
                                            {msg.contractStatus === 'cancelled' && (
                                                <div className="mt-4 flex items-center gap-2 text-destructive border-t pt-2">
                                                    <XCircle className="h-5 w-5" />
                                                    <p className="font-semibold text-sm">Contrato Cancelado</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : msg.isCancellation ? (
                                        <div className="mt-2 p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-yellow-500/30">
                                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                                <h4 className="font-semibold text-yellow-700">Confirmação de Cancelamento</h4>
                                            </div>
                                            <p className="text-sm text-yellow-800/90 whitespace-pre-wrap">{msg.text}</p>
                                            {msg.cancellationStatus === 'pending' && !userProfile?.isAdmin && (
                                                <Button size="sm" className="mt-4 bg-destructive hover:bg-destructive/90" onClick={() => handleCancelContract(msg.id)}>
                                                    Confirmar Cancelamento
                                                </Button>
                                            )}
                                            {msg.cancellationStatus === 'confirmed' && (
                                                 <div className="mt-4 flex items-center gap-2 text-destructive border-t pt-2">
                                                    <CheckCircle className="h-5 w-5" />
                                                    <p className="font-semibold text-sm">Cancelamento Confirmado</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{renderMessageText(msg.text)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                {/* Signature Confirmation Dialog */}
                <AlertDialog open={!!signingContract} onOpenChange={() => { setSigningContract(null); setConfirmationText(''); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Assinatura</AlertDialogTitle>
                            <AlertDialogDescription>
                                Para confirmar e assinar digitalmente, digite o nome completo do contratante como exibido no documento.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2">
                            <Label htmlFor="signatureName" className="text-muted-foreground">Nome Completo do Contratante</Label>
                            <Input
                                id="signatureName"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder="Digite o nome completo"
                                autoComplete="off"
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmSignature} disabled={confirmationText.trim() === ''}>Assinar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                {/* Cancellation Confirmation Dialog */}
                 <AlertDialog open={!!cancellingContract} onOpenChange={() => { setCancellingContract(null); setConfirmationText(''); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação é irreversível. Para confirmar, digite <strong>CANCELAR</strong> no campo abaixo.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2">
                            <Label htmlFor="cancellationText" className="text-muted-foreground">Confirmar Ação</Label>
                            <Input
                                id="cancellationText"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder="Digite CANCELAR"
                                autoComplete="off"
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmCancellation} variant="destructive" disabled={confirmationText !== 'CANCELAR'}>
                                Confirmar Cancelamento
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <div className="p-4 border-t border-border mt-auto flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={`Conversar em #${activeTicket.subject}`} className="flex-1 bg-input" autoComplete="off" disabled={activeTicket.status === 'closed'} />
                         {userProfile?.isAdmin && (
                            <AlertDialog open={isContractFormOpen} onOpenChange={setIsContractFormOpen}>
                                <AlertDialogTrigger asChild>
                                     <Button type="button" variant="outline" size="icon" className="flex-shrink-0" disabled={activeTicket.status === 'closed'}>
                                        <FileText className="h-4 w-4" />
                                        <span className="sr-only">Gerar Contrato</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Gerar Novo Contrato</AlertDialogTitle>
                                        <AlertDialogDescription>Preencha os detalhes abaixo para gerar o contrato.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <Form {...contractForm}>
                                        <form onSubmit={contractForm.handleSubmit(handleCreateContract)} className="space-y-4">
                                            <FormField control={contractForm.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Nome do Cliente</FormLabel><FormControl><Input placeholder="Nome completo" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={contractForm.control} name="clientCpf" render={({ field }) => ( <FormItem><FormLabel>CPF do Cliente</FormLabel><FormControl><Input placeholder="Apenas números" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={contractForm.control} name="object" render={({ field }) => ( <FormItem><FormLabel>Objeto do Contrato</FormLabel><FormControl><Textarea placeholder="Descrição detalhada do serviço" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={contractForm.control} name="deadline" render={({ field }) => ( <FormItem><FormLabel>Prazo de Entrega</FormLabel><FormControl><Input placeholder="Ex: 30 dias úteis" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={contractForm.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl><Input placeholder="Ex: 1500,00" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <AlertDialogFooter>
                                                <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                                                <Button type="submit">Gerar Contrato</Button>
                                            </AlertDialogFooter>
                                        </form>
                                    </Form>
                                </AlertDialogContent>
                            </AlertDialog>
                         )}
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
                    <div className="flex items-center gap-2">
                        {userProfile?.isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isClearing || tickets.length === 0}>
                                        {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                                        Limpar Todos
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Limpar todos os tickets?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação é irreversível e excluirá permanentemente todos os tickets de suporte. Tem certeza?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAllTickets} className="bg-destructive hover:bg-destructive/90">
                                            {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, limpar tudo"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button onClick={handleCreateGenericTicket} disabled={isCreating}>
                            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
                            Abrir Ticket
                        </Button>
                    </div>
                </div>
                 {userProfile?.isAdmin && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nome ou assunto..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                         <div className="flex items-center gap-2">
                            <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} size="sm">Todos</Button>
                            <Button variant={filter === 'support' ? 'default' : 'outline'} onClick={() => setFilter('support')} size="sm">Suporte</Button>
                            <Button variant={filter === 'quote' ? 'default' : 'outline'} onClick={() => setFilter('quote')} size="sm">Orçamentos</Button>
                            <Button variant={filter === 'purchase' ? 'default' : 'outline'} onClick={() => setFilter('purchase')} size="sm">Compras</Button>
                         </div>
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                    <div className="p-6 pt-0">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                <LifeBuoy className="mx-auto h-12 w-12" />
                                <h3 className="mt-4 text-lg font-semibold">Nenhum ticket encontrado</h3>
                                <p className="mt-1 text-sm">Você não tem tickets nesta categoria.</p>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {filteredTickets.map(ticket => (
                                    <li key={ticket.id} onClick={() => setActiveTicket(ticket)} className="p-3 bg-secondary rounded-md cursor-pointer hover:bg-accent transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getTicketTypeBadge(ticket.type)}
                                                    <p className="font-semibold text-foreground truncate">{ticket.subject}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {userProfile?.isAdmin ? `Usuário: ${ticket.userName}` : 'Clique para ver as mensagens'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={ticket.status === 'open' ? 'success' : 'destructive'}>{ticket.status}</Badge>
                                                {userProfile?.isAdmin && (
                                                     <AlertDialog onOpenChange={(open) => !open && setTicketToDelete(null)}>
                                                        <AlertDialogTrigger asChild onClick={(e) => { e.stopPropagation(); setTicketToDelete(ticket); }}>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir Ticket?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Tem certeza que deseja excluir o ticket para "{ticketToDelete?.subject}"? Esta ação é permanente.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => {e.stopPropagation(); handleDeleteTicket(ticketToDelete!);}}>Excluir</AlertDialogAction>
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
