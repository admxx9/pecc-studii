
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Book, Lock, Star, Wrench, Link as LinkIcon, Loader2, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Lesson } from '@/components/page/home-client-page';
import type { Tool } from '@/components/layout/tools-content';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

interface MainContentProps {
  lesson: Lesson;
  onMarkComplete: (lessonId: string) => void;
  isCompleted: boolean;
  isPremium?: boolean;
  userIsPremium?: boolean;
  onSelectTool: (toolId: string) => void;
}


export default function MainContent({
    lesson,
    onMarkComplete,
    isCompleted,
    isPremium,
    userIsPremium,
    onSelectTool,
}: MainContentProps) {
  const [supportTools, setSupportTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolIdFromUrl = searchParams.get('toolId');

  // Fetch linked support tools when lesson changes
  useEffect(() => {
    const fetchSupportTools = async () => {
      if (!db || !lesson.supportToolIds || lesson.supportToolIds.length === 0) {
        setSupportTools([]);
        return;
      }
      setIsLoadingTools(true);
      try {
        const toolsRef = collection(db, "tools");
        const toolPromises = lesson.supportToolIds.map(id => getDoc(doc(toolsRef, id)));
        const toolDocs = await Promise.all(toolPromises);

        const fetchedTools = toolDocs
           .filter(docSnap => docSnap.exists())
           .map(docSnap => ({
             id: docSnap.id,
             ...docSnap.data()
           })) as Tool[];

        setSupportTools(fetchedTools);
      } catch (error) {
        console.error("Error fetching support tools:", error);
        toast({ title: "Erro", description: "Não foi possível carregar as ferramentas de apoio.", variant: "destructive" });
        setSupportTools([]);
      } finally {
        setIsLoadingTools(false);
      }
    };

    fetchSupportTools();
  }, [lesson.supportToolIds, toast]);


  const handleMarkCompleteClick = () => {
     if (lesson) {
        onMarkComplete(lesson.id);
    }
  };

   // Function to handle clicking a support tool link
  const handleSupportToolClick = (toolId: string) => {
    console.log("Navigating to tool:", toolId);
    // Use router.push to navigate and ensure the correct tab/state is handled
    router.push(`/?toolId=${toolId}#ferramentas`); // Use hash to scroll if needed
    onSelectTool(toolId); // Inform parent (HomeClientPage) to switch tab etc.
  };

  const isLocked = isPremium && !userIsPremium;

  // Basic prevention (minor deterrent)
  const preventContextMenu = (e: React.MouseEvent) => e.preventDefault();

  return (
    <main id="main-content" className="flex-1 w-full max-w-4xl mx-auto my-4 px-2 md:px-0"> {/* Increased max-width slightly */}
      <Card className="bg-card rounded-lg shadow-lg overflow-hidden border-border">
        <CardHeader className="p-0">
          {/* Video Container */}
           <div
             onContextMenu={preventContextMenu} // Disable right-click on the video container
             className={cn(
                "aspect-video bg-secondary flex items-center justify-center text-muted-foreground relative max-h-[450px] overflow-hidden", // Slightly reduced max height
                isLocked && "bg-gradient-to-br from-primary/10 via-secondary to-secondary"
            )}>
             {/* No overlay needed here for screen recording prevention (it's ineffective) */}
             {isLocked ? (
                 <div className="flex flex-col items-center text-center p-6 text-primary">
                     <Lock className="w-12 h-12 mb-4" />
                     <h3 className="text-xl font-semibold mb-2">Conteúdo Premium</h3>
                     <p className="text-sm text-muted-foreground">
                         Faça upgrade para acessar esta aula e outros benefícios exclusivos.
                     </p>
                      <Button
                        size="sm"
                        className="mt-4 bg-primary hover:bg-primary/90"
                        onClick={() => router.push('/premium')}
                       >
                        Ver Planos Premium
                      </Button>
                 </div>
             ) : lesson.videoUrl ? (
               <iframe
                width="100%"
                height="100%"
                src={lesson.videoUrl}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="rounded-t-lg"
              ></iframe>
            ) : (
                 <div className="flex flex-col items-center text-center p-6 text-muted-foreground">
                    <VideoOff className="w-12 h-12 mb-4" />
                    <p>Vídeo indisponível para esta aula.</p>
                 </div>
            )}
          </div>
        </CardHeader>
         <CardContent className="p-4 md:p-5 space-y-3 md:space-4"> {/* Slightly adjusted padding */}
           {!isLocked && (
             <Button
                onClick={handleMarkCompleteClick}
                disabled={isCompleted}
                className={`w-full sm:w-auto transition-colors duration-200 ${
                isCompleted
                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
            >
                <Check className={`mr-2 h-4 w-4 ${isCompleted ? 'text-white' : 'text-white'}`} />
                {isCompleted ? 'Concluído' : 'Marcar como Concluído'}
            </Button>
           )}

          <div>
             <CardTitle className="text-xl md:text-2xl font-semibold text-foreground mb-1 flex items-center gap-1.5">
                 {isPremium && <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
                 {lesson.title}
             </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
             {isLocked ? "Descrição disponível para assinantes premium." : lesson.description}
            </CardDescription>
          </div>

          {/* Support Materials Section */}
           <div className="border-t border-border pt-3 md:pt-4 space-y-2">
             <h3 className="text-md font-semibold text-accent flex items-center">
              <Wrench className="mr-2 h-5 w-5 text-accent" />
              Ferramentas de Apoio
            </h3>
             {isLocked ? (
                <p className="text-sm text-muted-foreground">Ferramentas disponíveis para assinantes premium.</p>
             ) : isLoadingTools ? (
                 <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando ferramentas...
                 </div>
             ) : supportTools.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {supportTools.map(tool => (
                        <Button
                            key={tool.id}
                            variant="outline"
                            size="sm"
                            className="justify-start text-left h-auto py-1.5 hover:bg-accent/10 border-accent/50 text-accent text-xs"
                             onClick={() => handleSupportToolClick(tool.id)}
                            title={`Ir para a ferramenta: ${tool.name}`}
                        >
                             <LinkIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{tool.name}</span>
                        </Button>
                    ))}
                </div>
             ) : (
                 <p className="text-sm text-muted-foreground">Nenhuma ferramenta de apoio vinculada.</p>
             )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

