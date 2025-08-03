
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link'; // Import Link
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertTriangle, Wrench, Star, Lock, Info } from 'lucide-react'; // Added icons
import { db, auth } from "@/lib/firebase"; // Import Firestore instance and auth
import { collection, getDocs, query, orderBy, where, QueryConstraint, doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { User } from 'firebase/auth'; // Import User type from firebase/auth
import { useRouter, useSearchParams } from 'next/navigation'; // Import useRouter and useSearchParams
import { cn } from '@/lib/utils'; // Import cn
import type { Tool } from './tools-content'; // Import Tool type
import type { UserProfile } from '@/components/admin/manage-users'; // Import UserProfile
import { useToast } from "@/hooks/use-toast"; // Import useToast

interface ToolsContentProps {
  selectedCategory: string | null; // Accept the selected category
}

// Helper function to determine if the user can access the tool
const canUserAccessTool = (
    toolPlan: 'none' | 'basic' | 'pro' | null | undefined,
    userPlan: 'basic' | 'pro' | null | undefined
 ): boolean => {
    const required = toolPlan || 'none'; // Default to 'none' (free) if undefined/null
    if (required === 'none') return true; // Free tools are always accessible
    if (!userPlan) return false; // If user has no plan, they can't access paid tools
    if (required === 'basic') return userPlan === 'basic' || userPlan === 'pro'; // Basic required: Basic or Pro users can access
    if (required === 'pro') return userPlan === 'pro'; // Pro required: Only Pro users can access
    return false; // Default case (shouldn't happen with defined types)
 };


export default function ToolsContent({ selectedCategory }: ToolsContentProps) {
    const [tools, setTools] = useState<Tool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState<string | null>(null); // Store toolId being navigated to
    const [isDownloading, setIsDownloading] = useState<string | null>(null); // Store toolId being downloaded
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null); // State for Firebase User object
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null); // State for user profile data
    const router = useRouter(); // Initialize router
    const searchParams = useSearchParams(); // Get search params
    const highlightedToolRef = useRef<HTMLDivElement>(null); // Ref for potential highlighting/scrolling
    const { toast } = useToast(); // Initialize toast

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


    // Fetch tools based on selected category
    useEffect(() => {
        const fetchTools = async () => {
            if (!db) {
                setError("Erro de conexão com o banco de dados.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setTools([]); // Clear previous tools before fetching
            console.log(`Fetching tools. Selected category: ${selectedCategory}`);

            try {
                const toolsCol = collection(db, "tools");
                // Base query ordered by creation time (descending for newest first)
                const queryConstraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

                // Add category filter if one is selected
                if (selectedCategory) {
                     console.log(`Applying category filter: ${selectedCategory}`);
                    queryConstraints.push(where("category", "==", selectedCategory));
                }

                const toolsQuery = query(toolsCol, ...queryConstraints);
                const toolSnapshot = await getDocs(toolsQuery);

                const fetchedTools = toolSnapshot.docs.map(doc => ({
                    id: doc.id,
                    requiredPlan: doc.data().requiredPlan || 'none', // Fetch requiredPlan, default to 'none'
                    images: doc.data().images ?? [], // Fetch images, default to empty array
                    ...doc.data()
                })) as Tool[];

                 console.log(`Fetched ${fetchedTools.length} tools.`);
                setTools(fetchedTools);

            } catch (e: any) {
                console.error("Error fetching tools: ", e);
                 // Check for specific index error
                if (e.message && e.message.includes("query requires an index")) {
                    setError("Índice do Firestore ausente. Verifique o console do navegador para o link de criação do índice.");
                    console.error("Firestore Index Required: Please create the composite index using the link provided in the Firebase error message in your browser's console.");
                } else {
                    setError(`Erro ao carregar ferramentas: ${e.message || 'Erro desconhecido'}`);
                }
            } finally {
                setIsLoading(false);
                 console.log("Finished fetching tools.");
            }
        };

        fetchTools();
    }, [selectedCategory]); // Re-run effect when selectedCategory changes

    // Scroll to tool if toolId is present in URL
    useEffect(() => {
      const toolId = searchParams.get('toolId');
       console.log("ToolsContent useEffect triggered. toolId:", toolId, "isLoading:", isLoading, "tools count:", tools.length); // Add logging

      if (toolId && !isLoading && tools.length > 0) {
         console.log("Attempting to scroll to tool:", toolId);
         // Use requestAnimationFrame to ensure DOM is ready after state update
         requestAnimationFrame(() => {
             const element = document.getElementById(`tool-card-${toolId}`);
              console.log(`Finding element with ID: tool-card-${toolId}. Found:`, element); // Log element finding result
             if (element) {
                 console.log("Scrolling to element:", element);
                 element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 // Optional: Add temporary highlight effect
                  console.log("Applying highlight to element:", element);
                 element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
                 setTimeout(() => {
                     console.log("Removing highlight from element:", element);
                    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
                 }, 3000); // Remove highlight after 3 seconds
             } else {
                 console.warn("Could not find element for tool ID:", toolId);
             }
         });
      } else {
          console.log("Scroll condition not met. toolId:", toolId, "isLoading:", isLoading, "tools count:", tools.length);
      }
  }, [searchParams, isLoading, tools]); // Depend on searchParams, isLoading, and tools


    const categoryDisplayName = useMemo(() => {
        if (!selectedCategory) return 'Todas as Ferramentas';
        // Simple capitalization for display
        return selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
    }, [selectedCategory]);

   const handleInfoClick = (toolId: string) => {
        setIsNavigating(toolId); // Set loading state for the specific tool
        router.push(`/tools/${toolId}`);
        // No need for setTimeout, navigation handles it
    };

    // Handle Download Button Click
    const handleDownloadClick = async (tool: Tool) => {
         if (!tool || !tool.id) return;

         setIsDownloading(tool.id); // Set loading state for this button

        try {
            // ** IMPORTANT SECURITY NOTE **
            // Ideally, the API route should verify the user's session/token
            // and check their premium status on the server *before* returning the URL.
            // Since that requires more setup (Firebase Admin SDK), this current
            // implementation fetches the URL first, which isn't fully secure.
            const response = await fetch(`/api/tools/download/${tool.id}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to fetch download link." }));
                 throw new Error(errorData.error || `Error fetching download link: ${response.statusText}`);
            }

            const data = await response.json();
            const downloadUrl = data.downloadUrl;

            if (!downloadUrl) {
                throw new Error("Download URL not found.");
            }

            // Initiate download
            window.location.href = downloadUrl; // Simple redirect to download

             // Optional: Create a temporary link for better control (e.g., setting filename)
             /*
             const link = document.createElement('a');
             link.href = downloadUrl;
             link.setAttribute('download', ''); // Optional: Set a default filename if needed
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             */

            toast({
                title: "Download Iniciado",
                description: `Baixando ${tool.name}...`,
            });

        } catch (error: any) {
            console.error("Error getting download link:", error);
            toast({
                title: "Erro no Download",
                description: error.message || "Não foi possível obter o link de download.",
                variant: "destructive",
            });
        } finally {
            setIsDownloading(null); // Clear loading state
        }
    };


    return (
        <main className="flex-1">
            <Card className="bg-card rounded-lg shadow-lg overflow-hidden border-border">
                <CardHeader className="p-4 md:p-6">
                     <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Ferramentas de Modding</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                        {isLoading ? 'Carregando...' : `Explorando: ${categoryDisplayName}`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                    {isLoading ? (
                        // Skeleton Loader - Adjusted to single column
                        <div className="grid grid-cols-1 gap-4">
                            <Skeleton className="h-32 w-full rounded-md bg-secondary" />
                            <Skeleton className="h-32 w-full rounded-md bg-secondary" />
                        </div>
                     ) : error ? (
                        // Error Message
                        <div className="flex flex-col items-center justify-center h-40 text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/30">
                             <AlertTriangle className="w-10 h-10 mb-2" />
                             <p className="text-center font-medium">{error || 'Ocorreu um erro.'}</p>
                            {error?.includes("Índice do Firestore ausente") && (
                                <p className="text-xs text-center mt-2">Clique no link no console do desenvolvedor (F12) para criar o índice necessário.</p>
                            )}
                        </div>
                     ) : tools.length > 0 ? (
                        // Display Tools in a single column grid layout
                        <div className="grid grid-cols-1 gap-4">
                            {tools.map((tool) => {
                                // Determine if the tool is locked based on user's plan
                                const isLocked = !canUserAccessTool(tool.requiredPlan, userProfile?.premiumPlanType);
                                const isCurrentlyNavigating = isNavigating === tool.id;
                                const isCurrentlyDownloading = isDownloading === tool.id;

                                return (
                                    <Card
                                        key={tool.id}
                                        id={`tool-card-${tool.id}`} // Add unique ID for scrolling
                                        className="bg-secondary border-border p-4 flex flex-col rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        ref={searchParams.get('toolId') === tool.id ? highlightedToolRef : null} // Add ref conditionally
                                    >
                                        <div className="flex-1 mb-3">
                                            <h3 className="text-lg font-medium text-foreground flex items-center gap-1.5">
                                                 {/* Show star based on requiredPlan */}
                                                 {(tool.requiredPlan === 'basic' || tool.requiredPlan === 'pro') &&
                                                    <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" title={`Requer Plano ${tool.requiredPlan}`}/>
                                                 }
                                                {tool.name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-grow">{tool.description}</p> {/* Add flex-grow to push info down */}
                                            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                                <span>Versão: <span className="font-medium text-foreground/90">{tool.version}</span></span>
                                                <span>Tamanho: <span className="font-medium text-foreground/90">{tool.size}</span></span>
                                                <span>Categoria: <span className="font-medium text-foreground/90">{tool.category}</span></span>
                                            </div>
                                        </div>
                                        {/* Action Buttons Container at the bottom */}
                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0 mt-auto"> {/* mt-auto pushes to bottom */}
                                             {/* Information Button */}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-auto" // Added sm:w-auto
                                                onClick={() => handleInfoClick(tool.id)}
                                                disabled={isCurrentlyNavigating || isCurrentlyDownloading} // Disable if navigating or downloading this tool
                                                title="Ver informações da ferramenta"
                                             >
                                                {isCurrentlyNavigating ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Abrindo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Info className="mr-2 h-4 w-4" />
                                                        Informações
                                                    </>
                                                )}
                                            </Button>
                                             {/* Download / Premium Button */}
                                             {isLocked ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700 transition-colors w-full sm:w-auto" // Added sm:w-auto
                                                    onClick={() => router.push('/premium')}
                                                    disabled={isCurrentlyNavigating || isCurrentlyDownloading}
                                                >
                                                    <Lock className="mr-2 h-4 w-4" />
                                                     {/* Show specific plan required */}
                                                     Ver Planos Premium {tool.requiredPlan && tool.requiredPlan !== 'none' ? `(${tool.requiredPlan})` : ''}
                                                </Button>
                                             ) : (
                                                // Button now triggers API call instead of direct link
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownloadClick(tool)}
                                                    className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto" // Added sm:w-auto
                                                    disabled={isCurrentlyDownloading || isCurrentlyNavigating} // Disable if downloading this tool or navigating
                                                >
                                                     {isCurrentlyDownloading ? (
                                                         <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Baixando...
                                                         </>
                                                     ) : (
                                                         <>
                                                            <Download className="mr-2 h-4 w-4" />
                                                            Download
                                                         </>
                                                     )}
                                                </Button>
                                             )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                         // No Tools Found Message
                         <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-secondary/50 p-4 rounded-md border border-border">
                            <Wrench className="w-10 h-10 mb-2" />
                            <p className="text-center font-medium">
                                Nenhuma ferramenta encontrada {selectedCategory ? `para a categoria '${categoryDisplayName}'` : 'ainda'}.
                            </p>
                             {selectedCategory && (
                                 <p className="text-xs text-center mt-1">Tente selecionar outra categoria ou adicione novas ferramentas no painel de administração.</p>
                             )}
                             {!selectedCategory && (
                                 <p className="text-xs text-center mt-1">Adicione ferramentas no painel de administração para vê-las aqui.</p>
                             )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
