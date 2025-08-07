'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertTriangle, Wrench, Star, Lock, Info, Filter, ArrowUpDown, Tag } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, QueryConstraint, doc, getDoc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import { User } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Tool } from './tools-content';
import type { UserProfile } from '@/components/admin/manage-users';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

interface ToolsContentProps {
  selectedCategory: string | null;
}

const canUserAccessTool = (
    toolPlan: 'none' | 'basic' | 'pro' | null | undefined,
    userPlan: 'basic' | 'pro' | null | undefined
 ): boolean => {
    const required = toolPlan || 'none';
    if (required === 'none') return true;
    if (!userPlan) return false;
    if (required === 'basic') return userPlan === 'basic' || userPlan === 'pro';
    if (required === 'pro') return userPlan === 'pro';
    return false;
 };

export default function ToolsContent({ selectedCategory }: ToolsContentProps) {
    const [tools, setTools] = useState<Tool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightedToolRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // State for Loja filters
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc' for price
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const allTags = useMemo(() => {
        if (selectedCategory !== 'loja') return [];
        const tagsSet = new Set<string>();
        tools.forEach(tool => tool.tags?.forEach(tag => tagsSet.add(tag)));
        return Array.from(tagsSet).sort();
    }, [tools, selectedCategory]);

    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setCurrentUser(user);
        if (!user) setUserProfile(null);
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
                if (docSnap.exists()) setUserProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
                else setUserProfile(null);
            } catch (e) {
                console.error("Error fetching user profile:", e);
                setUserProfile(null);
            }
        };
        fetchUserProfile();
    }, [currentUser]);

    useEffect(() => {
        const fetchTools = async () => {
            if (!db) {
                setError("Erro de conexão com o banco de dados.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setTools([]);
            
            try {
                const toolsCol = collection(db, "tools");
                const queryConstraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
                if (selectedCategory) {
                    queryConstraints.push(where("category", "==", selectedCategory));
                }
                
                const toolsQuery = query(toolsCol, ...queryConstraints);
                const toolSnapshot = await getDocs(toolsQuery);

                const fetchedTools = toolSnapshot.docs.map(doc => ({
                    id: doc.id,
                    requiredPlan: doc.data().requiredPlan || 'none',
                    images: doc.data().images ?? [],
                    price: doc.data().price,
                    tags: doc.data().tags ?? [],
                    ...doc.data()
                })) as Tool[];
                setTools(fetchedTools);
            } catch (e: any) {
                console.error("Error fetching tools: ", e);
                if (e.message?.includes("query requires an index")) {
                    setError("Índice do Firestore ausente. Verifique o console do navegador para o link de criação do índice.");
                } else {
                    setError(`Erro ao carregar ferramentas: ${e.message || 'Erro desconhecido'}`);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchTools();
    }, [selectedCategory]);

    useEffect(() => {
      const toolId = searchParams.get('toolId');
      if (toolId && !isLoading && tools.length > 0) {
         requestAnimationFrame(() => {
             const element = document.getElementById(`tool-card-${toolId}`);
             if (element) {
                 element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
                 setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
                 }, 3000);
             }
         });
      }
  }, [searchParams, isLoading, tools]);

    const handleInfoClick = (toolId: string) => {
        setIsNavigating(toolId);
        router.push(`/tools/${toolId}`);
    };

    const handleDownloadClick = async (tool: Tool) => {
         if (!tool?.id) return;
         setIsDownloading(tool.id);
        try {
            const response = await fetch(`/api/tools/download/${tool.id}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to fetch download link." }));
                throw new Error(errorData.error || `Error fetching download link: ${response.statusText}`);
            }
            const data = await response.json();
            const downloadUrl = data.downloadUrl;
            if (!downloadUrl) throw new Error("Download URL not found.");
            window.location.href = downloadUrl;
            toast({ title: "Download Iniciado", description: `Baixando ${tool.name}...` });
        } catch (error: any) {
            toast({ title: "Erro no Download", description: error.message || "Não foi possível obter o link de download.", variant: "destructive" });
        } finally {
            setIsDownloading(null);
        }
    };

    const handleTagClick = (tag: string) => {
        setActiveTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredAndSortedTools = useMemo(() => {
        let processedTools = [...tools];
        if (selectedCategory === 'loja') {
            if (activeTags.length > 0) {
                processedTools = processedTools.filter(tool => 
                    activeTags.every(tag => tool.tags?.includes(tag))
                );
            }
            processedTools.sort((a, b) => {
                const priceA = a.price ?? 0;
                const priceB = b.price ?? 0;
                return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
            });
        }
        return processedTools;
    }, [tools, sortOrder, activeTags, selectedCategory]);

    const categoryDisplayName = useMemo(() => {
        if (!selectedCategory) return 'Todas as Ferramentas';
        return selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
    }, [selectedCategory]);

    return (
        <main className="flex-1">
            <Card className="bg-card rounded-lg shadow-lg overflow-hidden border-border">
                <CardHeader className="p-4 md:p-6 border-b">
                     <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">{categoryDisplayName}</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                        {isLoading ? 'Carregando...' : `Explore os itens disponíveis.`}
                    </CardDescription>
                     {selectedCategory === 'loja' && !isLoading && (
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                <Select onValueChange={setSortOrder} defaultValue={sortOrder}>
                                    <SelectTrigger className="w-full sm:w-[180px] bg-background">
                                        <SelectValue placeholder="Ordenar por..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="desc">Maior Preço</SelectItem>
                                        <SelectItem value="asc">Menor Preço</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                 <Tag className="h-4 w-4 text-muted-foreground" />
                                {allTags.length > 0 ? allTags.map(tag => (
                                    <Button key={tag} variant={activeTags.includes(tag) ? 'default' : 'outline'} size="sm" onClick={() => handleTagClick(tag)} className="capitalize text-xs h-8">
                                        {tag}
                                    </Button>
                                )) : <p className="text-xs text-muted-foreground">Nenhuma tag encontrada.</p>}
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-4">
                            <Skeleton className="h-32 w-full rounded-md bg-secondary" />
                            <Skeleton className="h-32 w-full rounded-md bg-secondary" />
                        </div>
                     ) : error ? (
                        <div className="flex flex-col items-center justify-center h-40 text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/30">
                             <AlertTriangle className="w-10 h-10 mb-2" />
                             <p className="text-center font-medium">{error}</p>
                            {error?.includes("Índice do Firestore ausente") && (
                                <p className="text-xs text-center mt-2">Clique no link no console (F12) para criar o índice.</p>
                            )}
                        </div>
                     ) : filteredAndSortedTools.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredAndSortedTools.map((tool) => {
                                const isLocked = !canUserAccessTool(tool.requiredPlan, userProfile?.premiumPlanType);
                                const isCurrentlyNavigating = isNavigating === tool.id;
                                const isCurrentlyDownloading = isDownloading === tool.id;

                                return (
                                    <Card
                                        key={tool.id}
                                        id={`tool-card-${tool.id}`}
                                        className="bg-secondary border-border p-4 flex flex-col sm:flex-row items-start gap-4 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        ref={searchParams.get('toolId') === tool.id ? highlightedToolRef : null}
                                    >
                                        {tool.images && tool.images[0] && (
                                            <div className="relative w-full h-32 sm:w-32 sm:h-auto sm:self-stretch flex-shrink-0 rounded-md overflow-hidden bg-background">
                                                <Image
                                                    src={tool.images[0]}
                                                    alt={`Thumbnail for ${tool.name}`}
                                                    fill
                                                    sizes="(max-width: 640px) 100vw, 128px"
                                                    className="object-cover"
                                                    data-ai-hint="tool image"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 flex flex-col h-full">
                                            <div className="flex-1 mb-3">
                                                <h3 className="text-lg font-medium text-foreground flex items-center gap-1.5">
                                                     {(tool.requiredPlan === 'basic' || tool.requiredPlan === 'pro') &&
                                                        <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" title={`Requer Plano ${tool.requiredPlan}`}/>
                                                     }
                                                    {tool.name}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-grow">{tool.description}</p>
                                                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                                    <span>Versão: <span className="font-medium text-foreground/90">{tool.version}</span></span>
                                                    <span>Tamanho: <span className="font-medium text-foreground/90">{tool.size}</span></span>
                                                    <span>Categoria: <span className="font-medium text-foreground/90">{tool.category}</span></span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-auto gap-2">
                                                 {tool.price !== undefined && tool.category === 'loja' && (
                                                    <div className="text-lg font-bold text-primary mb-2 sm:mb-0">
                                                        {tool.price > 0 ? `R$ ${tool.price.toFixed(2).replace('.', ',')}` : 'Grátis'}
                                                    </div>
                                                 )}
                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto self-end sm:ml-auto">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-auto"
                                                        onClick={() => handleInfoClick(tool.id)}
                                                        disabled={isCurrentlyNavigating || isCurrentlyDownloading}
                                                        title="Ver informações da ferramenta"
                                                    >
                                                        {isCurrentlyNavigating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Info className="mr-2 h-4 w-4" />}
                                                        Informações
                                                    </Button>
                                                    {isLocked ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700 transition-colors w-full sm:w-auto"
                                                            onClick={() => router.push('/premium')}
                                                            disabled={isCurrentlyNavigating || isCurrentlyDownloading}
                                                        >
                                                            <Lock className="mr-2 h-4 w-4" />
                                                            Ver Planos Premium
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownloadClick(tool)}
                                                            className="hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-auto"
                                                            disabled={isCurrentlyDownloading || isCurrentlyDownloading}
                                                        >
                                                            {isCurrentlyDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                            Download
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                         <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-secondary/50 p-4 rounded-md border border-border">
                            <Wrench className="w-10 h-10 mb-2" />
                            <p className="text-center font-medium">
                                Nenhum item encontrado {selectedCategory ? `para a categoria '${categoryDisplayName}' com os filtros atuais` : 'ainda'}.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
