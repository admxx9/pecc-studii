'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// import { Switch } from "@/components/ui/switch"; // Remove Switch import
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
    FormDescription, // Import FormDescription
} from "@/components/ui/form";
import { db } from "@/lib/firebase"; // Import Firestore instance
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, PencilRuler, Code, Boxes, Cog, Star, ShoppingCart } from 'lucide-react'; // Icons for categories, added Star and ShoppingCart

// Define categories - must match IDs used in Sidebar/ToolsContent
export const toolCategories = [
    { id: 'mapas', name: 'Mapas', icon: LayoutGrid },
    { id: 'texturas', name: 'Texturas', icon: PencilRuler },
    { id: 'scripts', name: 'Scripts', icon: Code },
    { id: 'modelos', name: 'Modelos 3D', icon: Boxes },
    { id: 'geral', name: 'Geral', icon: Cog },
    { id: 'loja', name: 'Loja', icon: ShoppingCart },
];
const categoryIds = toolCategories.map(cat => cat.id) as [string, ...string[]]; // For Zod enum

interface AddToolFormProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings' | 'manage-codes') => void;
}

// Define Zod schema for tool form validation, including requiredPlan and images
export const toolFormSchema = z.object({
    name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres." }),
    description: z.string().min(10, { message: "Descrição deve ter pelo menos 10 caracteres." }),
    downloadUrl: z.string().url({ message: "Por favor, insira uma URL de download válida." }),
    version: z.string().min(1, { message: "Versão é obrigatória." }),
    size: z.string().min(1, { message: "Tamanho é obrigatório (ex: 50MB, 1.2GB)." }),
    category: z.enum(categoryIds, { required_error: "Selecione uma categoria." }),
    requiredPlan: z.enum(['none', 'basic', 'pro']).default('none'), // Use enum for plan requirement
    images: z.string().optional(), // Optional string for image URLs (one per line)
    // specifications: z.string().optional(), // Optional string for specifications (key:value per line)
});

export type ToolFormData = z.infer<typeof toolFormSchema>;

export default function AddToolForm({ setSection }: AddToolFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<ToolFormData>({
        resolver: zodResolver(toolFormSchema),
        defaultValues: {
            name: "",
            description: "",
            downloadUrl: "",
            version: "",
            size: "",
            category: undefined, // Start with no category selected
            requiredPlan: 'none', // Default to 'none' (free)
            images: "", // Default empty images string
            // specifications: "", // Default empty specifications string
        },
    });

    // Function to handle form submission and save to Firestore
    async function onSubmit(values: ToolFormData) {
        if (!db) {
            toast({
                title: "Erro de Conexão",
                description: "Não foi possível conectar ao banco de dados.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);

        // Process images string into array
        const imageArray = values.images?.split('\n').map(url => url.trim()).filter(url => url) || [];


        console.log("Form values (Tool):", values); // Log values before sending
        console.log("Processed images:", imageArray);

        try {
            // Add the new tool document to the 'tools' collection
            const docRef = await addDoc(collection(db, "tools"), {
                name: values.name,
                description: values.description,
                downloadUrl: values.downloadUrl,
                version: values.version,
                size: values.size,
                category: values.category,
                requiredPlan: values.requiredPlan, // Save requiredPlan instead of isPremium
                images: imageArray, // Save the array of image URLs
                createdAt: serverTimestamp(), // Add a server timestamp for ordering
            });
            console.log("Tool added with ID: ", docRef.id); // Log success

            // Save notification to firestore
             await addDoc(collection(db, "notifications"), {
                 title: "Nova Ferramenta Adicionada!",
                 message: `Uma nova ferramenta "${values.name}" na categoria "${values.category}" foi adicionada. Baixe agora!`, // Updated message for tool
                 type: "info", // Type for standard new tool notification
                 read: false,
                 createdAt: serverTimestamp(),
                 target: "global",
                 targetUserEmail: null,
                 lessonId: null, // No lesson associated with a tool
              });

            // Show success toast
            toast({
                title: "Ferramenta Adicionada!",
                description: `A ferramenta "${values.name}" foi criada com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white" // Green success toast
            });

            form.reset(); // Reset form fields after successful submission
            setSection('manage-tools'); // Go back to manage-tools list after successful submission

        } catch (error: any) {
            console.error("Error adding tool: ", error); // Log the error

            // Show error toast
            toast({
                title: "Erro ao Adicionar Ferramenta",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false); // Re-enable the button
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Nome da Ferramenta</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: World Editor" {...field} className="bg-input" />
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
                            <FormLabel className="text-foreground">Descrição</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Descreva a ferramenta e sua função..." {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField
                        control={form.control}
                        name="version"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Versão</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: 2.1" {...field} className="bg-input" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Tamanho</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: 250MB" {...field} className="bg-input" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Categoria</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="bg-input">
                                            <SelectValue placeholder="Selecione a categoria" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {toolCategories.map(cat => (
                                             <SelectItem key={cat.id} value={cat.id}>
                                                <div className="flex items-center gap-2">
                                                   <cat.icon className="h-4 w-4 text-primary" />
                                                    {cat.name}
                                                 </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="downloadUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">URL de Download</FormLabel>
                            <FormControl>
                                <Input placeholder="https://link.para/download" {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Images Field */}
                <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">URLs das Imagens (Opcional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Cole uma URL por linha..."
                                    {...field}
                                    className="bg-input h-24" // Adjust height as needed
                                />
                            </FormControl>
                             <FormDescription className="text-xs text-muted-foreground">
                                Insira as URLs das imagens de pré-visualização da ferramenta, uma por linha.
                             </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Select for Required Plan */}
                 <FormField
                    control={form.control}
                    name="requiredPlan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Plano Necessário</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-input">
                                        <SelectValue placeholder="Selecione o plano mínimo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum (Grátis)</SelectItem>
                                    <SelectItem value="basic">
                                        <div className="flex items-center gap-1.5">
                                            <Star className="h-4 w-4 text-yellow-500" /> Básico
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pro">
                                         <div className="flex items-center gap-1.5">
                                            <Star className="h-4 w-4 text-yellow-500" /> Pro
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                             <FormDescription className="text-xs text-muted-foreground">
                                Selecione o plano mínimo necessário para acessar esta ferramenta.
                             </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                 />

                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="secondary" onClick={() => setSection('manage-tools')} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                        {isSubmitting ? "Salvando..." : "Adicionar Ferramenta"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
