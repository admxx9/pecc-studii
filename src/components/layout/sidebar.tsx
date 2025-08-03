
'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link'; // Import Link
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button"; // Import Button
import type { ActiveTab, Lesson as PageLesson } from '@/app/page';
import { cn } from '@/lib/utils';
import { LayoutGrid, PencilRuler, Code, Boxes, Cog, VideoOff, CheckCircle, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Lesson extends PageLesson {}

interface ToolCategory {
  id: string;
  name: string;
  icon: React.ElementType;
}

const toolCategories: ToolCategory[] = [
    { id: 'mapas', name: 'Mapas', icon: LayoutGrid },
    { id: 'texturas', name: 'Texturas', icon: PencilRuler },
    { id: 'scripts', name: 'Scripts', icon: Code },
    { id: 'modelos', name: 'Modelos 3D', icon: Boxes },
    { id: 'geral', name: 'Geral', icon: Cog },
];

interface SidebarProps {
  activeTab: ActiveTab;
  selectedToolCategory: string | null;
  setSelectedToolCategory: (category: string | null) => void;
  selectedLessonId: string | null;
  setSelectedLessonId: (lessonId: string | null) => void;
  lessons: Lesson[];
  progressPercentage: number;
  isLoading: boolean;
}

export default function Sidebar({
  activeTab,
  selectedToolCategory,
  setSelectedToolCategory,
  selectedLessonId,
  setSelectedLessonId,
  lessons,
  progressPercentage,
  isLoading
}: SidebarProps) {

  const handleCategoryClick = (categoryId: string) => {
    setSelectedToolCategory(categoryId === selectedToolCategory ? null : categoryId);
  };

   const handleLessonClick = (lessonId: string) => {
    setSelectedLessonId(lessonId);
  };

   const lessonsByCategory = useMemo(() => {
    return lessons.reduce((acc, lesson) => {
      const categoryKey = `category-${lesson.category || 'Geral'}`;
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push(lesson);
      return acc;
    }, {} as { [key: string]: Lesson[] });
  }, [lessons]);

  const defaultOpenCategory = useMemo(() => {
    if (selectedLessonId) {
      const selectedLesson = lessons.find(l => l.id === selectedLessonId);
      if (selectedLesson) {
        return `category-${selectedLesson.category || 'Geral'}`;
      }
    }
    const categories = Object.keys(lessonsByCategory).sort();
    return categories.length > 0 ? categories[0] : undefined;
}, [selectedLessonId, lessons, lessonsByCategory]);

  return (
    <aside className="w-full md:w-72 bg-card p-2 md:p-4 rounded-lg shadow-lg flex flex-col space-y-2 md:space-y-4 h-full">

      {activeTab === 'aulas' && (
        <>
          <div className="space-y-1 px-2">
            <h2 className="text-md font-semibold text-foreground">Seu Progresso</h2>
            <Progress value={isLoading ? 0 : progressPercentage} className="w-full h-2 [&>div]:bg-accent" aria-label={`Progresso do curso ${progressPercentage}%`} />
            <p className="text-xs text-muted-foreground">{isLoading ? 'Calculando...' : `${progressPercentage}% completo`}</p>
          </div>


          <div className="flex-grow overflow-hidden px-2 pt-2"> {/* Add pt-2 */}
             <h3 className="text-sm font-semibold text-foreground mb-2">Aulas</h3>
             <ScrollArea className="h-full pr-1">
               <div className="space-y-2.5">
                {isLoading ? (
                  <>
                    <Skeleton className="h-[70px] w-full rounded-md bg-secondary" />
                    <Skeleton className="h-[70px] w-full rounded-md bg-secondary" />
                    <Skeleton className="h-[70px] w-full rounded-md bg-secondary" />
                    <Skeleton className="h-[70px] w-full rounded-md bg-secondary" />
                  </>
                ) : Object.keys(lessonsByCategory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                        <VideoOff className="w-10 h-10 mb-2" />
                        <p className="text-sm">Nenhuma aula disponível no momento.</p>
                    </div>
                ) : (
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full space-y-1"
                        defaultValue={defaultOpenCategory}
                    >
                    {Object.entries(lessonsByCategory)
                      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                      .map(([categoryKey, categoryLessons]) => {
                        const categoryName = categoryKey.replace('category-', '');
                        return (
                            <AccordionItem value={categoryKey} key={categoryKey} className="bg-secondary/50 rounded-md border border-border">
                                <AccordionTrigger className="px-3 py-2 text-sm font-medium text-foreground hover:no-underline hover:bg-secondary rounded-t-md [&[data-state=open]]:rounded-b-none [&>svg]:h-4 [&>svg]:w-4">
                                     {categoryName}
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                     <div className="space-y-1.5 p-2">
                                        {categoryLessons.map((lesson) => (
                                        <Card
                                          key={lesson.id}
                                          onClick={() => handleLessonClick(lesson.id)}
                                          className={cn(
                                            "flex items-center bg-secondary shadow-sm hover:shadow-md hover:scale-[1.02] hover:bg-primary/10 transition-all duration-200 cursor-pointer group overflow-hidden p-2 rounded-md",
                                            selectedLessonId === lesson.id ? 'border border-primary' : 'border border-transparent'
                                          )}>
                                          {/* Image on the left */}
                                          <div className="relative w-16 h-10 flex-shrink-0 mr-3"> {/* Fixed small size */}
                                             <Image
                                              src={lesson.imageUrl || `https://picsum.photos/seed/${lesson.id}/100/60`} // Smaller fallback
                                              alt={`Thumbnail for ${lesson.title}`}
                                              fill
                                              sizes="64px" // Specify smaller size
                                              className="rounded object-cover"
                                              priority={lessons.findIndex(l => l.id === lesson.id) < 5} // Only prioritize first few
                                              onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${lesson.id}/100/60`; }}
                                              data-ai-hint="lesson thumbnail"
                                            />
                                          </div>
                                          {/* Content on the right */}
                                           <div className="flex-grow min-w-0">
                                             <CardTitle className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate flex items-center gap-1">
                                                 {lesson.isPremium && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                                                 {lesson.title}
                                            </CardTitle>
                                             <CardDescription className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{lesson.description}</CardDescription>
                                             {/* Status: Completed/Pending */}
                                             <div className={cn(
                                                "text-[10px] mt-1 text-right flex items-center justify-end",
                                                lesson.completed ? "text-green-500 font-medium" : "text-muted-foreground/70"
                                                )}>
                                               {lesson.completed && <CheckCircle className="w-3 h-3 mr-1 text-green-500" />}
                                               {lesson.completed ? 'Concluída' : 'Pendente'}
                                             </div>
                                           </div>
                                        </Card>
                                      ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                    </Accordion>
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {activeTab === 'ferramentas' && (
        <>
          <div className="space-y-1 px-2">
            <h2 className="text-md font-semibold text-foreground">Categorias</h2>
             <p className="text-xs text-muted-foreground">Filtre as ferramentas por categoria.</p>
          </div>
          <div className="flex-grow overflow-hidden px-2">
            <ScrollArea className="h-full pr-1">
              <div className="space-y-2">
                {toolCategories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
                      selectedToolCategory === category.id ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-secondary text-foreground'
                    )}
                  >
                    <category.icon className={cn(
                      "h-4 w-4 transition-colors flex-shrink-0",
                       selectedToolCategory === category.id ? 'text-accent-foreground' : 'text-primary'
                    )} />
                    <span className="text-xs font-medium truncate">{category.name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

       {activeTab === 'admin' && (
         <div className="flex-1 p-2 md:p-4 pl-4 md:pl-6"> {/* Added pl-4 and md:pl-6 */}
             <h2 className="text-md font-semibold text-foreground">Admin</h2>
             <p className="text-xs text-muted-foreground">Opções de administração.</p>
         </div>
       )}

    </aside>
  );
}
