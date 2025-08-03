
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
import { ArrowLeft, Download, Lock, Star, Info, Wrench } from 'lucide-react'; // Import icons
import type { Tool } from '@/components/layout/tools-content'; // Import Tool type
import type { UserProfile } from '@/components/admin/manage-users'; // Import UserProfile

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

export default function ToolDetailPage() {
    const [tool, setTool] = useState<Tool | null>(null);
    const [isLoading, setIsLoading] =useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null); // Add state for user profile
    const router = useRouter();
    const params = useParams();
    const toolId = params?.toolId as string; // Get toolId from URL

    // Listen for auth state changes
    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setCurrentUser(user);
         if (!user) {
            setUserProfile(null); // Clear profile if user logs out
        }
      });
      return () => unsubscribe(); // Cleanup listener on unmount
    }, []);

     // Fetch user profile data (including premiumPlanType) when currentUser changes
     useEffect(() => {
        const fetchUserProfile = async () => {
             if (!currentUser || !db) {
                 setUserProfile(null); // Clear profile if no user or db
                 return;
             }
            const userDocRef = doc(db, 'users', currentUser.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    setUserProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile); // Set user profile data
                } else {
                    setUserProfile(null); // User profile doesn't exist
                }
            } catch (e) {
                console.error("Error fetching user profile:", e);
                 setUserProfile(null); // Clear profile on error
            }
        };
        fetchUserProfile();
    }, [currentUser]);

    // Fetch tool details based on toolId
    useEffect(() => {
        const fetchToolDetails = async () => {
            if (!toolId || !db) {
                setIsLoading(false);
                console.error("Tool ID or DB not available");
                // Optionally redirect to a 404 page or show error
                return;
            }
            setIsLoading(true);
            const toolDocRef = doc(db, 'tools', toolId);
            try {
                const docSnap = await getDoc(toolDocRef);
                if (docSnap.exists()) {
                    setTool({
                         id: docSnap.id,
                         requiredPlan: docSnap.data().requiredPlan || 'none', // Fetch requiredPlan
                         images: docSnap.data().images ?? [], // Fetch images, default to empty
                         specifications: docSnap.data().specifications ?? {}, // Fetch specs, default to empty obj
                          ...docSnap.data()
                        } as Tool);
                } else {
                    console.log("No such tool document!");
                    setTool(null); // Handle tool not found
                     // Optionally redirect or show not found message
                     // router.push('/tools/not-found');
                }
            } catch (error) {
                console.error("Error fetching tool details:", error);
                setTool(null); // Handle error state
            } finally {
                setIsLoading(false);
            }
        };

        fetchToolDetails();
    }, [toolId, router]);

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                 <header className="bg-card px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)]">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-8 w-24" />
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

    // Determine if the tool is locked based on user's plan
    const isLocked = !canUserAccessTool(tool.requiredPlan, userProfile?.premiumPlanType);


    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             {/* Simplified Header for Detail Page */}
             <header className="bg-card px-4 md:px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)] sticky top-0 z-30">
                <Button variant="outline" onClick={() => router.push('/#ferramentas')} className="text-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <h1 className="text-lg md:text-xl font-semibold text-foreground truncate px-4">
                    {tool.name}
                </h1>
                 {/* Placeholder for potential right-side actions */}
                <div className="w-20"></div> {/* Balance the header */}
            </header>

            <main className="flex-1 container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
                <Card className="max-w-4xl mx-auto bg-card shadow-xl border-border rounded-lg overflow-hidden">
                     {/* Image Carousel/Display */}
                     {tool.images && tool.images.length > 0 && (
                        <div className="relative h-64 md:h-80 bg-secondary flex items-center justify-center overflow-hidden">
                            {/* Basic image display for now, could be a carousel later */}
                            <Image
                                src={tool.images[0]} // Display the first image
                                alt={`${tool.name} preview`}
                                fill
                                style={{ objectFit: 'contain' }} // Use style object for objectFit
                                priority
                                data-ai-hint="tool image"
                            />
                        </div>
                     )}

                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-2xl md:text-3xl font-semibold text-foreground flex items-center gap-2">
                             {/* Show star if requiredPlan is basic or pro */}
                             {(tool.requiredPlan === 'basic' || tool.requiredPlan === 'pro') && <Star className="w-6 h-6 text-yellow-500 flex-shrink-0" />}
                            {tool.name}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground pt-1">
                            {tool.description}
                        </CardDescription>
                         {/* Basic Info: Version, Size, Category */}
                         <div className="text-sm text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3">
                            <span>Versão: <span className="font-medium text-foreground/90">{tool.version}</span></span>
                            <span>Tamanho: <span className="font-medium text-foreground/90">{tool.size}</span></span>
                            <span>Categoria: <span className="font-medium text-foreground/90">{tool.category}</span></span>
                             {/* Display required plan */}
                             <span>Plano: <span className="font-medium text-foreground/90 capitalize">{tool.requiredPlan || 'Nenhum'}</span></span>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 md:p-6 pt-0">
                         {/* Specifications Section */}
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

                        {/* Download/Premium Button */}
                        <div className="mt-6 border-t pt-6 flex justify-end">
                            {isLocked ? (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700 transition-colors"
                                    onClick={() => router.push('/premium')}
                                >
                                    <Lock className="mr-2 h-5 w-5" />
                                    Ver Planos Premium para Baixar {tool.requiredPlan && `(${tool.requiredPlan})`}
                                </Button>
                            ) : (
                                <Button
                                    variant="default"
                                    size="lg"
                                    asChild
                                    className="bg-primary hover:bg-primary/90"
                                >
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
