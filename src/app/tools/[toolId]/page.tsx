
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { ArrowLeft, Download, Lock, Star, Info, Wrench, Gift, QrCode, Copy, Loader2, ShoppingCart, Ticket } from 'lucide-react'; // Import icons
import type { Tool } from '@/components/layout/tools-content'; // Import Tool type
import type { UserProfile } from '@/components/admin/manage-users'; // Import UserProfile
import Header from '@/components/layout/header'; // Import the standard Header
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";


// Helper function to determine if the user can access the tool
const canUserAccessTool = (
    toolPlan: 'none' | 'basic' | 'pro' | null | undefined,
    userPlan: 'basic' | 'pro' | null | undefined
 ): boolean => {
    const required = toolPlan || 'none'; // Default to 'none' (free) if undefined/null
    if (required === 'none') return true; // Free tools are always accessible
    if (required === 'basic') return userPlan === 'basic' || userPlan === 'pro'; // Basic required: Basic or Pro users can access
    if (required === 'pro') return userPlan === 'pro'; // Pro required: Only Pro users can access
    return false; // Default case (shouldn't happen with defined types)
 };

 // Discord link to get a purchase code
const DISCORD_PURCHASE_INFO_LINK = "https://discord.gg/YP9UraDH4k";

export default function ToolDetailPage() {
    const [tool, setTool] = useState<Tool | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [purchaseView, setPurchaseView] = useState<'buy' | 'redeem'>('buy');
    const [redemptionCode, setRedemptionCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const toolId = params?.toolId as string;

    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setCurrentUser(user);
         if (!user) {
            setUserProfile(null);
        }
      });
      return () => unsubscribe();
    }, []);

     useEffect(() => {
        const fetchUserProfile = async () => {
             if (!currentUser || !db) {
                 setUserProfile(null);
                 return;
             }
            const userDocRef = doc(db, 'users', currentUser.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    setUserProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
                } else {
                    setUserProfile(null);
                }
            } catch (e) {
                console.error("Error fetching user profile:", e);
                 setUserProfile(null);
            }
        };
        fetchUserProfile();
    }, [currentUser]);

    useEffect(() => {
        const fetchToolDetails = async () => {
            if (!toolId || !db) {
                setIsLoading(false);
                console.error("Tool ID or DB not available");
                return;
            }
            setIsLoading(true);
            const toolDocRef = doc(db, 'tools', toolId);
            try {
                const docSnap = await getDoc(toolDocRef);
                if (docSnap.exists()) {
                    setTool({
                         id: docSnap.id,
                         requiredPlan: docSnap.data().requiredPlan || 'none',
                         images: docSnap.data().images ?? [],
                         specifications: docSnap.data().specifications ?? {},
                          ...docSnap.data()
                        } as Tool);
                } else {
                    console.log("No such tool document!");
                    setTool(null);
                }
            } catch (error) {
                console.error("Error fetching tool details:", error);
                setTool(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchToolDetails();
    }, [toolId, router]);
    
     const handleSignOut = async () => {
      if (auth) {
        await auth.signOut();
        router.push('/');
      }
    };

    const handleGoToPurchaseInfo = () => {
        window.open(DISCORD_PURCHASE_INFO_LINK, '_blank', 'noopener,noreferrer');
    };

    const handleRedeemCode = async () => {
        // TODO: Implement redemption logic similar to premium page
        toast({ title: "Em Breve", description: "A funcionalidade de resgatar códigos para itens da loja será implementada em breve.", variant: "default" });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                 <header className="bg-card px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)]">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                 </header>
                <main className="flex-1 container mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <Skeleton className="h-10 w-32 mb-6" />
                    <Skeleton className="h-64 w-full mb-6" />
                    <Skeleton className="h-8 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-6" />
                    <Skeleton className="h-10 w-40" />
                </main>
            </div>
        );
    }

    if (!tool) {
        return (
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Wrench className="w-16 h-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Ferramenta Não Encontrada</h1>
                <p className="text-muted-foreground mb-6">A ferramenta que você procura não existe ou foi removida.</p>
                <Button variant="outline" onClick={() => router.push('/#ferramentas')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Ferramentas
                </Button>
            </div>
        );
    }

    const isLocked = !canUserAccessTool(tool.requiredPlan, userProfile?.premiumPlanType);

    const renderPurchaseModalContent = () => {
        if (purchaseView === 'redeem') {
             return (
                 <>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Ticket /> Resgatar Código</DialogTitle>
                        <DialogDescription>Insira o código do produto que você adquiriu.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 py-4">
                         <Input
                            type="text"
                            placeholder="SEU-CODIGO-AQUI"
                            value={redemptionCode}
                            onChange={(e) => setRedemptionCode(e.target.value)}
                            className="flex-grow bg-input text-base uppercase"
                            disabled={isRedeeming}
                        />
                         <div className="flex flex-col sm:flex-row gap-2 mt-2">
                             <Button variant="outline" onClick={() => setPurchaseView('buy')} disabled={isRedeeming} className="w-full sm:w-auto">
                                <ArrowLeft className="mr-2 h-4 w-4"/> Voltar
                            </Button>
                            <Button onClick={handleRedeemCode} disabled={isRedeeming} className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex-grow">
                                {isRedeeming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ativando...</> : "Ativar Produto"}
                            </Button>
                        </div>
                    </div>
                </>
             )
        }
        // Default 'buy' view
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Adquirir: {tool.name}</DialogTitle>
                    <DialogDescription>Escolha como deseja obter este item.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                     <Button variant="default" size="lg" className="h-auto py-4 flex flex-col gap-2" onClick={handleGoToPurchaseInfo}>
                        <Gift className="h-6 w-6" />
                        <span className="font-semibold">Obter Código no Discord</span>
                        <span className="text-xs font-normal text-primary-foreground/80">Adquira seu código em nosso servidor.</span>
                    </Button>
                    <Button variant="secondary" size="lg" className="h-auto py-4 flex flex-col gap-2" onClick={() => setPurchaseView('redeem')}>
                        <Ticket className="h-6 w-6"/>
                        <span className="font-semibold">Resgatar Código</span>
                        <span className="text-xs font-normal text-secondary-foreground/80">Já tem um código? Insira aqui.</span>
                    </Button>
                </div>
            </>
        );
    };


    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Header
                activeTab={'ferramentas'}
                setActiveTab={(tab) => router.push(`/#${tab}`)}
                isLoggedIn={!!currentUser}
                onSignOut={handleSignOut}
                userName={userProfile?.displayName}
                userRank={userProfile?.rank}
                isAdmin={userProfile?.isAdmin ?? false}
                userAvatarUrl={userProfile?.photoURL}
             />

            <main className="flex-1 container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
                 <div className="mb-6 flex justify-start">
                    <Button variant="outline" onClick={() => router.push('/#ferramentas')} className="text-sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Ferramentas
                    </Button>
                </div>
                <Card className="max-w-4xl mx-auto bg-card shadow-xl border-border rounded-lg overflow-hidden">
                     {tool.images && tool.images.length > 0 && (
                        <div className="relative h-64 md:h-80 bg-secondary flex items-center justify-center overflow-hidden">
                            <Image
                                src={tool.images[0]}
                                alt={`${tool.name} preview`}
                                fill
                                style={{ objectFit: 'contain' }}
                                priority
                                data-ai-hint="tool image"
                            />
                        </div>
                     )}

                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-2xl md:text-3xl font-semibold text-foreground flex items-center gap-2">
                             {(tool.requiredPlan === 'basic' || tool.requiredPlan === 'pro') && <Star className="w-6 h-6 text-yellow-500 flex-shrink-0" />}
                            {tool.name}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground pt-1">
                            {tool.description}
                        </CardDescription>
                         <div className="text-sm text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3">
                            <span>Versão: <span className="font-medium text-foreground/90">{tool.version}</span></span>
                            <span>Tamanho: <span className="font-medium text-foreground/90">{tool.size}</span></span>
                            <span>Categoria: <span className="font-medium text-foreground/90">{tool.category}</span></span>
                             <span>Plano: <span className="font-medium text-foreground/90 capitalize">{tool.requiredPlan || 'Nenhum'}</span></span>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 md:p-6 pt-0">
                         {tool.specifications && Object.keys(tool.specifications).length > 0 && (
                            <div className="mt-4 border-t pt-4">
                                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <Info className="h-5 w-5" /> Especificações
                                </h3>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                    {Object.entries(tool.specifications).map(([key, value]) => (
                                        <li key={key}>
                                            <span className="font-medium text-foreground/90">{key}:</span> {value}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-6 border-t pt-6 flex justify-end">
                             {tool.category === 'loja' ? (
                                <Dialog open={isPurchaseModalOpen} onOpenChange={(open) => { setIsPurchaseModalOpen(open); if (!open) { setPurchaseView('buy'); } }}>
                                     <DialogTrigger asChild>
                                         <Button variant="default" size="lg" className="bg-primary hover:bg-primary/90">
                                            <ShoppingCart className="mr-2 h-5 w-5" />
                                            {tool.price && tool.price > 0 ? `Comprar por R$ ${tool.price.toFixed(2).replace('.', ',')}` : 'Adquirir (Grátis)'}
                                        </Button>
                                    </DialogTrigger>
                                     <DialogContent>
                                        {renderPurchaseModalContent()}
                                    </DialogContent>
                                </Dialog>
                            ) : isLocked ? (
                                <Button variant="outline" size="lg" className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700" onClick={() => router.push('/premium')}>
                                    <Lock className="mr-2 h-5 w-5" />
                                    Ver Planos Premium para Baixar {tool.requiredPlan && `(${tool.requiredPlan})`}
                                </Button>
                            ) : (
                                <Button variant="default" size="lg" asChild className="bg-primary hover:bg-primary/90">
                                    <a href={tool.downloadUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-5 w-5" />
                                        Download ({tool.size})
                                    </a>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
