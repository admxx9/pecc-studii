
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Import Switch for premium toggle
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Import Select components
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Card } from "@/components/ui/card"; // Import Card
import { db } from "@/lib/firebase"; // Import Firestore instance
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore"; // Import Firestore functions
import { useToast } from "@/hooks/use-toast";
import type { Tool } from '@/components/layout/tools-content'; // Import Tool type

interface AddLessonFormProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings') => void; // Updated section type
}

// Define Zod schema for form validation including category, premium status, and supportToolIds
const lessonFormSchema = z.object({
    title: z.string().min(3, { message: "Título deve ter pelo menos 3 caracteres." }),
    description: z.string().min(10, { message: "Descrição deve ter pelo menos 10 caracteres." }),
    imageUrl: z.string().url({ message: "Por favor, insira uma URL de imagem válida." }),
    videoUrl: z.string().url({ message: "Por favor, insira uma URL de vídeo do YouTube válida (formato embed)." })
        .regex(/^(https?:\/\/)?(www\.)?youtube\.com\/embed\/.+$/, { message: "URL do YouTube inválida. Use o formato 'embed', ex: https://www.youtube.com/embed/VIDEO_ID" }),
    supportToolIds: z.array(z.string()).optional().default([]), // Array of selected tool IDs
    category: z.string().min(1, { message: "Selecione ou digite uma categoria." }), // Changed from module to category, required
    isPremium: z.boolean().default(false), // Add premium toggle field
});

type LessonFormData = z.infer<typeof lessonFormSchema>;

export default function AddLessonForm({ setSection }: AddLessonFormProps) { // Accept setSection
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tools, setTools] = useState<Tool[]>([]); // State to hold available tools
    const [isLoadingTools, setIsLoadingTools] = useState(true);
    const { toast } = useToast();

    // Example categories (fetch or define these as needed)
    // You might want to fetch these from Firestore later
    const [lessonCategories, setLessonCategories] = useState<string[]>(["Introdução", "Texturas", "Scripts", "Modelagem", "Geral"]);
    const [newCategory, setNewCategory] = useState('');

    const form = useForm<LessonFormData>({
        resolver: zodResolver(lessonFormSchema),
        defaultValues: {
            title: "",
            description: "",
            imageUrl: "",
            videoUrl: "",
            supportToolIds: [], // Default to empty array
            category: "", // Default empty category
            isPremium: false, // Default to not premium
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


     const handleAddCategory = () => {
        if (newCategory.trim() && !lessonCategories.includes(newCategory.trim())) {
            setLessonCategories([...lessonCategories, newCategory.trim()]);
            form.setValue('category', newCategory.trim()); // Select the new category
            setNewCategory(''); // Clear the input
        }
    };

    // Function to handle form submission and save to Firestore
    async function onSubmit(values: LessonFormData) {
        if (!db) {
          toast({
            title: "Erro de Conexão",
            description: "Não foi possível conectar ao banco de dados.",
            variant: "destructive",
          });
          return;
        }
        setIsSubmitting(true);
        console.log("Form values:", values); // Log values before sending

        try {
            // Add the new lesson document to the 'lessons' collection
            const docRef = await addDoc(collection(db, "lessons"), {
                ...values,
                createdAt: serverTimestamp(), // Add a server timestamp for ordering
            });
            console.log("Lesson added with ID: ", docRef.id); // Log success

             // Save notification to firestore
             await addDoc(collection(db, "notifications"), {
                 title: "Nova Aula Adicionada!",
                 message: `Uma nova aula "${values.title}" na categoria "${values.category}" foi adicionada. Confira agora!`, // Updated message
                 type: "info", // Keep type as info for standard new lesson notifications
                 read: false,
                 createdAt: serverTimestamp(),
                 target: "global",
                 targetUserEmail: null,
                 lessonId: docRef.id, // Store the lesson ID to link to it
              });

            // Show success toast (changed to blue)
            toast({
                title: "Aula Adicionada!",
                description: `A aula "${values.title}" (Categoria: ${values.category}) foi criada com sucesso.`, // Updated description
                 variant: "default", // Keep variant default or adjust if you have a specific 'info' variant
                 className: "bg-blue-500 border-blue-500 text-white" // Blue info toast
            });

            form.reset(); // Reset form fields after successful submission
            setSection('manage-lessons'); // Go back to manage-lessons list after successful submission

        } catch (error: any) {
             console.error("Error adding lesson: ", error); // Log the error

            // Show error toast
            toast({
                title: "Erro ao Adicionar Aula",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false); // Re-enable the button
        }
    }

    return (
        // Removed DialogHeader and wrapping elements
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
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
                 {/* Category Selection/Creation */}
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Categoria da Aula</FormLabel>
                            <div className="flex gap-2">
                                <FormControl>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger className="bg-input flex-grow">
                                            <SelectValue placeholder="Selecione ou crie uma categoria" />
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
                                        placeholder="Ou digite uma nova"
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

                 {/* Switch for Premium status */}
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
                                                     render={({ field }) => {
                                                     return (
                                                        <FormItem
                                                            key={tool.id}
                                                            className="flex flex-row items-start space-x-3 space-y-0"
                                                        >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(tool.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                    ? field.onChange([...(field.value || []), tool.id])
                                                                    : field.onChange(
                                                                        (field.value || []).filter(
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


                {/* Removed DialogFooter and DialogClose */}
                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="secondary" onClick={() => setSection('manage-lessons')} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                        {isSubmitting ? "Salvando..." : "Adicionar Aula"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
    