
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Import next/image
import Link from 'next/link'; // Import Link
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, getDocs, collection, query, where, orderBy, Timestamp } from 'firebase/firestore'; // Import updateDoc
import { auth, db } from '@/lib/firebase';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { User as UserIcon, Mail, Edit, Crown, ArrowLeft, Star, Upload, RefreshCw, Loader2, FileText, Download, AlertCircle } from 'lucide-react'; // Import Star icon, Upload
import UpdateProfileForm from '@/components/profile/update-profile-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { ranks } from '@/config/ranks';
import { cn } from '@/lib/utils'; // Import cn
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface UserProfileData {
    displayName: string;
    email: string | null;
    photoURL: string | null;
    rank: string;
    isAdmin: boolean;
    isPremium?: boolean; // Add premium status
    premiumPlanType?: 'basic' | 'pro' | null; // Add premium plan type
    bannerURL?: string | null; // Add banner URL
}

interface Contract {
    id: string; // messageId
    text: string;
    contractStatus: 'pending' | 'signed';
    createdAt: Timestamp;
    ticketId: string;
}


export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false); // State for the edit dialog
    const [isUpdatingBanner, setIsUpdatingBanner] = useState(false); // State for banner update
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoadingContracts, setIsLoadingContracts] = useState(true);
    const contractRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});


    const router = useRouter();
    const { toast } = useToast();

    const defaultBannerUrl = 'https://i.imgur.com/VmlfAGR.jpeg';

    const fetchUserProfile = useCallback(async (userId: string) => {
        if (!db) return null;
        const userDocRef = doc(db, 'users', userId);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    displayName: data.displayName || user?.displayName || 'Usuário',
                    email: data.email || user?.email || 'N/A',
                    photoURL: data.photoURL || user?.photoURL || null,
                    rank: data.rank || 'iniciante',
                    isAdmin: data.isAdmin === true,
                    isPremium: data.isPremium === true, // Fetch premium status
                    premiumPlanType: data.premiumPlanType || null, // Fetch premium plan type
                    bannerURL: data.bannerURL || defaultBannerUrl, // Fetch banner URL or use default
                } as UserProfileData;
            } else {
                 const defaultProfile: UserProfileData = {
                    displayName: user?.displayName || 'Novo Usuário',
                    email: user?.email || 'N/A',
                    photoURL: user?.photoURL || null,
                    rank: 'iniciante',
                    isAdmin: false,
                    isPremium: false,
                    premiumPlanType: null,
                    bannerURL: defaultBannerUrl, // Use default banner
                };
                 return defaultProfile;
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    }, [user]);

     const fetchContracts = useCallback(async (userId: string) => {
        if (!db) return;
        setIsLoadingContracts(true);
        const userContracts: Contract[] = [];
        try {
            // Find all tickets related to the user
            const ticketsQuery = query(collection(db, 'supportTickets'), where('userId', '==', userId));
            const ticketsSnapshot = await getDocs(ticketsQuery);

            // For each ticket, check for contract messages
            for (const ticketDoc of ticketsSnapshot.docs) {
                const messagesQuery = query(collection(ticketDoc.ref, 'messages'), where('isContract', '==', true), orderBy('createdAt', 'desc'));
                const messagesSnapshot = await getDocs(messagesQuery);
                messagesSnapshot.forEach(msgDoc => {
                    const data = msgDoc.data();
                    userContracts.push({
                        id: msgDoc.id,
                        text: data.text,
                        contractStatus: data.contractStatus,
                        createdAt: data.createdAt,
                        ticketId: ticketDoc.id,
                    });
                });
            }
            setContracts(userContracts);
        } catch (error) {
            console.error("Error fetching contracts:", error);
            toast({ title: "Erro", description: "Não foi possível carregar seus contratos.", variant: "destructive" });
        } finally {
            setIsLoadingContracts(false);
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userProfile = await fetchUserProfile(currentUser.uid);
                setProfile(userProfile);
                await fetchContracts(currentUser.uid);
            } else {
                setUser(null);
                setProfile(null);
                setContracts([]);
                router.push('/');
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [fetchUserProfile, fetchContracts, router]);

    const handleSignOut = async () => {
      if (auth) {
        await auth.signOut();
        router.push('/');
      }
    };

    const handleProfileUpdate = (updatedData: Partial<UserProfileData>) => {
        console.log("Profile update triggered in parent:", updatedData);
        // Update local state with new data, including potentially the bannerURL
        setProfile(prev => prev ? { ...prev, ...updatedData } : null);
        setIsEditing(false); // Close dialog after update
    };

    const handleUpdateBanner = async () => {
        if (!user || !db) {
            toast({ title: "Erro", description: "Você precisa estar logado para atualizar.", variant: "destructive" });
            return;
        }
        setIsUpdatingBanner(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userDocRef, {
                bannerURL: defaultBannerUrl
            });
            // Optimistically update the local state
            setProfile(prev => prev ? { ...prev, bannerURL: defaultBannerUrl } : null);
            toast({
                title: "Banner Atualizado!",
                description: "Seu banner de perfil foi atualizado para o novo padrão.",
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });
        } catch (error: any) {
            console.error("Error updating banner:", error);
            toast({ title: "Erro", description: "Não foi possível atualizar o banner.", variant: "destructive" });
        } finally {
            setIsUpdatingBanner(false);
        }
    };
    
    const handleDownloadPdf = async (contractId: string) => {
        const contractElement = contractRefs.current[contractId];
        if (!contractElement) {
            toast({ title: "Erro", description: "Não foi possível encontrar o conteúdo do contrato para gerar o PDF.", variant: "destructive" });
            return;
        }

        toast({ title: "Gerando PDF...", description: "Por favor, aguarde.", variant: "default" });

        try {
            // Ensure images inside the element are loaded before capturing
            const images = Array.from(contractElement.getElementsByTagName('img'));
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => { img.onload = resolve; });
            }));

            const canvas = await html2canvas(contractElement, {
                scale: 2, // Increase scale for better resolution
                backgroundColor: '#0f0f1a', // Match the dark theme background
                useCORS: true, // For images from other origins
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`contrato-${contractId}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Erro ao Gerar PDF", description: "Ocorreu um problema ao tentar criar o arquivo PDF.", variant: "destructive" });
        }
    };


    if (isLoading || !user) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <header className="bg-card px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)]">
                    <Skeleton className="h-8 w-48" />
                     <Skeleton className="h-9 w-9 rounded-full" />
                 </header>
                <div className="flex-1 flex items-center justify-center">
                   <p className="text-muted-foreground animate-pulse">Carregando perfil...</p>
                </div>
            </div>
        );
    }

    const dummySetActiveTab = () => {};

    const activeContracts = contracts.filter(c => c.contractStatus === 'pending' || c.contractStatus === 'signed');
    const finalizedContracts = contracts.filter(c => c.contractStatus !== 'pending' && c.contractStatus !== 'signed');


    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            {/* Keep the standard header */}
            <Header
                activeTab={'aulas'} // Default or irrelevant for profile page
                setActiveTab={dummySetActiveTab}
                isLoggedIn={!!user}
                onSignOut={handleSignOut}
                userName={profile?.displayName}
                userRank={profile?.rank}
                isAdmin={profile?.isAdmin ?? false}
                userAvatarUrl={profile?.photoURL}
            />
            <main className="flex-1 container mx-auto pt-8 pb-12 px-4 sm:px-6 lg:px-8">
                 {/* Back Button Remains */}
                 <div className="mb-6 flex justify-start">
                    <Button variant="outline" onClick={() => router.push('/')} className="text-sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Home
                    </Button>
                </div>

                {/* Profile Card - Redesigned */}
                <Card className="max-w-4xl mx-auto bg-card shadow-xl border-border rounded-lg overflow-hidden">
                    {/* Banner Section */}
                    <div className="h-48 md:h-64 bg-secondary relative group">
                         {profile?.bannerURL ? (
                            <Image
                                src={profile.bannerURL}
                                alt={`${profile.displayName}'s banner`}
                                layout="fill"
                                objectFit="cover"
                                priority // Consider making banner priority if above the fold
                                data-ai-hint="gaming banner"
                            />
                         ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary to-accent/10"></div> // Placeholder gradient
                         )}
                         {/* Temporary Banner Update Button */}
                         {profile?.bannerURL !== defaultBannerUrl && (
                             <div className="absolute top-2 right-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-background/80 backdrop-blur-sm text-xs"
                                    onClick={handleUpdateBanner}
                                    disabled={isUpdatingBanner}
                                >
                                    {isUpdatingBanner ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    Atualizar Banner
                                </Button>
                             </div>
                         )}
                    </div>

                    {/* Profile Info Section */}
                    <div className="p-6 md:p-8 relative">
                        {/* Avatar (Overlaps Banner) */}
                         <div className="absolute -top-12 left-6 md:left-8 transform">
                            {/* Wrap Avatar and Edit Button in a relative container */}
                            <div className="relative group">
                                <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background bg-background shadow-lg">
                                    <AvatarImage src={profile?.photoURL || undefined} alt={profile?.displayName} />
                                    <AvatarFallback className="text-4xl md:text-5xl">
                                        {profile?.displayName ? profile.displayName.substring(0, 2).toUpperCase() : <UserIcon className="h-12 w-12 md:h-16 md:w-16" />}
                                    </AvatarFallback>
                                </Avatar>
                                {/* Edit Icon/Button Overlay - Triggers dialog */}
                                <Dialog open={isEditing && !isEditing} onOpenChange={(open) => { if (!open) setIsEditing(false); /* prevent closing immediately */ }}>
                                    <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-background hover:text-primary"
                                          title="Editar foto de perfil"
                                          onClick={() => setIsEditing(true)} // Explicitly set editing state
                                        >
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">Editar foto de perfil</span>
                                        </Button>
                                    </DialogTrigger>
                                    {/* Content is now outside the trigger scope to manage open state */}
                                </Dialog>
                            </div>
                         </div>

                         {/* Profile Details (Positioned below Avatar space) */}
                         <div className="pt-16 md:pt-20 flex flex-col md:flex-row md:items-end md:justify-between">
                             {/* Left: Name, Email, Badges */}
                            <div className="mb-4 md:mb-0">
                                <CardTitle className="text-2xl md:text-3xl font-semibold text-foreground mb-1">{profile?.displayName || 'Usuário'}</CardTitle>
                                <CardDescription className="text-muted-foreground flex items-center gap-1.5 text-sm mb-2">
                                     <Mail className="h-4 w-4" /> {profile?.email || 'Email não disponível'}
                                </CardDescription>
                                {/* Badges Section */}
                                <div className="flex items-center gap-2 flex-wrap mt-2">
                                    {/* Rank or Admin Badge */}
                                    {profile?.isAdmin ? (
                                        <Badge variant="default" className="bg-primary text-primary-foreground px-3 py-1 text-sm font-bold flex items-center">
                                            <Crown className="h-4 w-4 mr-1.5" /> ADMIN
                                        </Badge>
                                     ) : (
                                        <Badge variant="secondary" className="px-3 py-1 text-sm">
                                            {/* Display user rank */}
                                            {ranks[profile?.rank?.toLowerCase() || 'iniciante'] || 'Iniciante'}
                                        </Badge>
                                     )}

                                     {/* Premium Status: Show Badge if premium, Button if not */}
                                     {profile?.isPremium ? (
                                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 px-3 py-1 text-sm font-medium flex items-center">
                                            <Star className="h-4 w-4 mr-1.5 text-yellow-500" />
                                            Premium {profile.premiumPlanType === 'pro' ? 'Pro' : profile.premiumPlanType === 'basic' ? 'Básico' : ''}
                                        </Badge>
                                     ) : (
                                        // Show 'View Premium Plans' button if user is NOT premium
                                        <Button asChild variant="outline" size="sm" className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700 transition-colors text-xs px-3 py-1 h-auto">
                                          <Link href="/premium">
                                            <Star className="h-3 w-3 mr-1.5" />
                                            Ver Planos e Serviços
                                          </Link>
                                        </Button>
                                      )}
                                </div>
                             </div>
                             {/* Right: Edit Button (Triggers the dialog) */}
                             <div className="flex-shrink-0 mt-4 md:mt-0">
                                 <Dialog open={isEditing} onOpenChange={setIsEditing}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">
                                            <Edit className="h-4 w-4 mr-2" /> Editar Perfil
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[480px] bg-card border-border">
                                        {/* Render form only when user and profile are loaded */}
                                        {user && profile ? (
                                            <UpdateProfileForm
                                                currentUser={user}
                                                currentProfile={profile}
                                                onUpdateSuccess={handleProfileUpdate}
                                                setOpen={setIsEditing}
                                            />
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground">Carregando dados...</div>
                                        )}
                                    </DialogContent>
                                 </Dialog>
                             </div>
                         </div>
                    </div>
                </Card>

                {/* Contracts Section */}
                <Card className="max-w-4xl mx-auto bg-card shadow-xl border-border rounded-lg overflow-hidden mt-8">
                     <CardHeader>
                        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                             <FileText className="h-5 w-5" />
                             Meus Contratos
                        </CardTitle>
                        <CardDescription>
                            Visualize e gerencie seus contratos de serviço.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                         <Tabs defaultValue="active" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="active">Ativos ({activeContracts.length})</TabsTrigger>
                                <TabsTrigger value="finalized">Finalizados ({finalizedContracts.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="active" className="mt-4">
                                {isLoadingContracts ? (
                                     <div className="space-y-3">
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                     </div>
                                ) : activeContracts.length > 0 ? (
                                     <div className="space-y-3">
                                        {activeContracts.map(contract => (
                                            <div key={contract.id} className="border p-4 rounded-md bg-secondary/50">
                                                {/* Hidden div for PDF generation */}
                                                <div ref={el => contractRefs.current[contract.id] = el} className="pdf-content hidden">
                                                    <div className="p-8 bg-[#0f0f1a] text-gray-200 font-sans">
                                                         <img 
                                                             src="https://i.imgur.com/sXliRZl.png"
                                                             alt="Logo"
                                                             className="w-24 h-24 mx-auto mb-4" 
                                                             crossOrigin="anonymous" // Add crossorigin attribute
                                                         />
                                                        <h1 className="text-2xl font-bold text-center mb-6 text-white">Contrato de Serviço</h1>
                                                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{contract.text}</pre>
                                                        <div className="mt-8 pt-4 border-t border-gray-600 text-xs text-gray-400">
                                                            <p>Documento gerado em: {new Date().toLocaleDateString()}</p>
                                                            <p>ID do Contrato: {contract.id}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                     <div className="flex-1">
                                                         <p className="font-semibold text-foreground">Contrato de Serviço</p>
                                                         <p className="text-xs text-muted-foreground">ID do Ticket: {contract.ticketId}</p>
                                                         <Badge variant={contract.contractStatus === 'signed' ? 'success' : 'outline'} className="mt-2 capitalize">
                                                            {contract.contractStatus === 'signed' ? 'Assinado' : 'Pendente'}
                                                         </Badge>
                                                     </div>
                                                     <Button size="sm" onClick={() => handleDownloadPdf(contract.id)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Baixar PDF
                                                     </Button>
                                                 </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                     <p className="text-center text-muted-foreground py-6">Nenhum contrato ativo encontrado.</p>
                                )}
                            </TabsContent>
                             <TabsContent value="finalized" className="mt-4">
                                {isLoadingContracts ? (
                                    <p className="text-center text-muted-foreground py-6">Carregando...</p>
                                ) : finalizedContracts.length > 0 ? (
                                    <div className="space-y-3">
                                        {/* Map finalized contracts here */}
                                    </div>
                                ) : (
                                     <p className="text-center text-muted-foreground py-6">Nenhum contrato finalizado encontrado.</p>
                                )}
                            </TabsContent>
                         </Tabs>
                     </CardContent>
                </Card>
            </main>
        </div>
    );
}
