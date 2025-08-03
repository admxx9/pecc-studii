
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Import Switch
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { Card } from "@/components/ui/card"; // Import Card
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Import Select components
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from 'lucide-react';
import type { Lesson } from '@/app/page';
import type { Tool } from '@/components/layout/tools-content'; // Import Tool type
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


// Reuse or redefine the lesson form schema including category, premium status, and supportToolIds
const lessonFormSchema = z.object({
    title: z.string().min(3, { message: "Título deve ter pelo menos 3 caracteres." }),
    description: z.string().min(10, { message: "Descrição deve ter pelo menos 10 caracteres." }),
    imageUrl: z.string().url({ message: "Por favor, insira uma URL de imagem válida." }),
    videoUrl: z.string().url({ message: "Por favor, insira uma URL de vídeo do YouTube válida (formato embed)." })
        .regex(/^(https?:\/\/)?(www\.)?youtube\.com\/embed\/.+$/, { message: "URL do YouTube inválida. Use o formato 'embed', ex: https://www.youtube.com/embed/VIDEO_ID" }),
    supportToolIds: z.array(z.string()).optional().default([]), // Array of selected tool IDs
    category: z.string().min(1, { message: "Selecione ou digite uma categoria." }), // Changed from module
    isPremium: z.boolean().default(false),
});

type LessonFormData = z.infer<typeof lessonFormSchema>;

interface EditLessonFormProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings') => void;
    lesson: Lesson; // The lesson data to edit
}

export default function EditLessonForm({ setSection, lesson }: EditLessonFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [tools, setTools] = useState<Tool[]>([]); // State to hold available tools
    const [isLoadingTools, setIsLoadingTools] = useState(true);
    const { toast } = useToast();
    // Example categories (fetch or define these as needed)
    const [lessonCategories, setLessonCategories] = useState<string[]>(["Introdução", "Texturas", "Scripts", "Modelagem", "Geral"]);

    const form = useForm<LessonFormData>({
        resolver: zodResolver(lessonFormSchema),
        defaultValues: { // Pre-fill form with existing lesson data
            title: lesson.title || "",
            description: lesson.description || "",
            imageUrl: lesson.imageUrl || "",
            videoUrl: lesson.videoUrl || "",
            supportToolIds: lesson.supportToolIds || [], // Pre-fill with existing tool IDs
            category: lesson.category || "Geral", // Default to 'Geral' if not present
            isPremium: lesson.isPremium || false, // Default to false
        },
    });

     // Fetch available tools from Firestore
     useEffect(() => {
        const fetchTools = async () => {
            if (!db) {
                toast({ title: "Erro", description: "Banco de dados não disponível.", variant: "destructive" });
                setIsLoadingTools(false);
                return;
            }
            setIsLoadingTools(true);
            try {
                const toolsCol = collection(db, "tools");
                const toolsQuery = query(toolsCol, orderBy("name", "asc")); // Order tools by name
                const toolSnapshot = await getDocs(toolsQuery);
                const fetchedTools = toolSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Tool[];
                setTools(fetchedTools);
            } catch (error) {
                console.error("Error fetching tools for lesson form:", error);
                toast({ title: "Erro", description: "Não foi possível carregar as ferramentas.", variant: "destructive" });
            } finally {
                setIsLoadingTools(false);
            }
        };
        fetchTools();
    }, [toast]);

    // Add new category to the list if the current lesson's category isn't there
    React.useEffect(() => {
        if (lesson.category && !lessonCategories.includes(lesson.category)) {
            setLessonCategories(prev => [...prev, lesson.category]);
        }
    }, [lesson.category, lessonCategories]);

    // Function to handle form submission and update Firestore
    async function onSubmit(values: LessonFormData) {
        if (!db) {
            toast({ title: "Erro de Conexão", description: "Banco de dados indisponível.", variant: "destructive" });
            return;
        }
        if (!lesson || !lesson.id) {
             toast({ title: "Erro Interno", description: "ID da aula inválido.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        console.log("Updating lesson:", lesson.id, "with values:", values);

        const lessonDocRef = doc(db, "lessons", lesson.id);

        try {
            await updateDoc(lessonDocRef, {
                ...values,
                // Optionally update a 'lastModified' timestamp here
                // lastModifiedAt: serverTimestamp(),
            });

            toast({
                title: "Aula Atualizada!",
                description: `A aula "${values.title}" foi atualizada com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });

            setSection('manage-lessons'); // Go back to the list after successful update

        } catch (error: any) {
            console.error("Error updating lesson: ", error);
            toast({
                title: "Erro ao Atualizar",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    // Function to handle deletion
    async function handleDelete() {
         if (!db || !lesson || !lesson.id) {
            toast({ title: "Erro", description: "Não foi possível identificar a aula para excluir.", variant: "destructive" });
            return;
         }
         setIsDeleting(true);
         const lessonDocRef = doc(db, "lessons", lesson.id);
         const lessonTitle = lesson.title; // Store name for toast

         try {
            await deleteDoc(lessonDocRef);
             toast({
                title: "Aula Excluída!",
                description: `A aula "${lessonTitle}" foi removida com sucesso.`,
                variant: "default",
            });
             setSection('manage-lessons'); // Go back to list after delete

         } catch (error: any) {
             console.error("Error deleting lesson: ", error);
             toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover a aula "${lessonTitle}": ${error.message}`,
                variant: "destructive",
            });
         } finally {
             setIsDeleting(false);
         }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                {/* Form fields are the same as AddLessonForm, but pre-filled */}
                 <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Título da Aula</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Introdução ao Modding" {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Descrição da Aula</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Descreva o conteúdo da aula..." {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">URL da Imagem (Thumbnail)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://picsum.photos/seed/..." {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="videoUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">URL do Vídeo (YouTube Embed)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://www.youtube.com/embed/VIDEO_ID" {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 {/* Category Selection/Input */}
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Categoria da Aula</FormLabel>
                             <div className="flex gap-2">
                                 <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="bg-input flex-grow">
                                            <SelectValue placeholder="Selecione ou digite uma categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lessonCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormControl>
                                    <Input
                                        placeholder="Ou edite a categoria"
                                        value={field.value.startsWith("category-") ? "" : field.value} // Clear if a selection was made
                                        onChange={(e) => field.onChange(e.target.value)} // Allow typing directly
                                        className="bg-input flex-grow"
                                    />
                                </FormControl>
                             </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="isPremium"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-secondary/50">
                            <div className="space-y-0.5">
                                <FormLabel className="text-foreground">Aula Premium?</FormLabel>
                                <FormMessage />
                            </div>
                             <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-label="Marcar como aula premium" // Add aria-label for accessibility
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 {/* Support Tools Selection */}
                <FormField
                    control={form.control}
                    name="supportToolIds"
                    render={({ field }) => (
                        <FormItem>
                             <FormLabel className="text-foreground">Ferramentas de Apoio (Opcional)</FormLabel>
                             <Card className="border p-3 bg-input">
                                <ScrollArea className="h-32"> {/* Adjust height as needed */}
                                    <div className="space-y-2">
                                         {isLoadingTools ? (
                                            <p className="text-muted-foreground text-sm">Carregando ferramentas...</p>
                                         ) : tools.length === 0 ? (
                                            <p className="text-muted-foreground text-sm">Nenhuma ferramenta disponível para vincular.</p>
                                         ) : (
                                             tools.map((tool) => (
                                                 <FormField
                                                     key={tool.id}
                                                     control={form.control}
                                                     name="supportToolIds"
                                                     render={({ field: checkboxField }) => { // Use a different name for the inner field
                                                     return (
                                                        <FormItem
                                                            key={tool.id}
                                                            className="flex flex-row items-start space-x-3 space-y-0"
                                                        >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={checkboxField.value?.includes(tool.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                    ? checkboxField.onChange([...(checkboxField.value || []), tool.id])
                                                                    : checkboxField.onChange(
                                                                        (checkboxField.value || []).filter(
                                                                            (value) => value !== tool.id
                                                                        )
                                                                        )
                                                                }}
                                                            />
                                                         </FormControl>
                                                        <FormLabel className="font-normal text-sm text-foreground">
                                                            {tool.name} ({tool.category})
                                                        </FormLabel>
                                                      </FormItem>
                                                     )
                                                    }}
                                                />
                                            ))
                                         )}
                                    </div>
                                </ScrollArea>
                             </Card>
                             <FormMessage />
                         </FormItem>
                    )}
                 />


                 {/* Action Buttons */}
                <div className="flex justify-between items-center gap-2 mt-6 pt-4 border-t border-border">
                     {/* Delete Button with Confirmation */}
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="flex items-center gap-2" disabled={isSubmitting || isDeleting}>
                                <Trash2 className="h-4 w-4" />
                                {isDeleting ? "Excluindo..." : "Excluir Aula"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja excluir a aula "{lesson.title}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setLessonToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                     {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                     </AlertDialog>

                    {/* Cancel and Save Buttons */}
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setSection('manage-lessons')} disabled={isSubmitting || isDeleting}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isDeleting}>
                            {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                     </div>
                </div>
            </form>
        </Form>
    );
}
