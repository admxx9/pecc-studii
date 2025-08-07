'use client';

import React, { useState, useEffect } from 'react';
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
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription, // Import FormDescription
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, PencilRuler, Code, Boxes, Cog, Trash2, Star, ShoppingCart } from 'lucide-react'; // Added Star and ShoppingCart
import { toolCategories, toolFormSchema, ToolFormData } from './add-tool-form'; // Import shared elements
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
} from "@/components/ui/alert-dialog"


interface EditToolFormProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings' | 'manage-codes') => void;
    tool: Tool; // The tool data to edit
}

export default function EditToolForm({ setSection, tool }: EditToolFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const form = useForm<ToolFormData>({
        resolver: zodResolver(toolFormSchema),
        defaultValues: { // Pre-fill form with existing tool data
            name: tool.name || "",
            description: tool.description || "",
            downloadUrl: tool.downloadUrl || "",
            version: tool.version || "",
            size: tool.size || "",
            category: tool.category || undefined,
            requiredPlan: tool.requiredPlan || 'none', // Pre-fill required plan, default to 'none'
            images: tool.images?.join('\n') || "", // Join image URLs with newline
        },
    });

    // Function to handle form submission and update Firestore
    async function onSubmit(values: ToolFormData) {
        if (!db) {
            toast({ title: "Erro de Conexão", description: "Banco de dados indisponível.", variant: "destructive" });
            return;
        }
        if (!tool || !tool.id) {
             toast({ title: "Erro Interno", description: "ID da ferramenta inválido.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        // Process images string back into array
        const imageArray = values.images?.split('\n').map(url => url.trim()).filter(url => url) || [];

        console.log("Updating tool:", tool.id, "with values:", values);
         console.log("Processed images for update:", imageArray);

        const toolDocRef = doc(db, "tools", tool.id);

        try {
            await updateDoc(toolDocRef, {
                name: values.name,
                description: values.description,
                downloadUrl: values.downloadUrl,
                version: values.version,
                size: values.size,
                category: values.category,
                requiredPlan: values.requiredPlan, // Save updated requiredPlan
                images: imageArray, // Save updated image array
            });

            toast({
                title: "Ferramenta Atualizada!",
                description: `A ferramenta "${values.name}" foi atualizada com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });

            setSection('manage-tools'); // Go back to the list after successful update

        } catch (error: any) {
            console.error("Error updating tool: ", error);
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
         if (!db || !tool || !tool.id) {
            toast({ title: "Erro", description: "Não foi possível identificar a ferramenta para excluir.", variant: "destructive" });
            return;
         }
         setIsDeleting(true);
         const toolDocRef = doc(db, "tools", tool.id);
         const toolName = tool.name; // Store name for toast

         try {
            await deleteDoc(toolDocRef);
             toast({
                title: "Ferramenta Excluída!",
                description: `A ferramenta "${toolName}" foi removida com sucesso.`,
                variant: "default",
            });
             setSection('manage-tools'); // Go back to list after delete

         } catch (error: any) {
             console.error("Error deleting tool: ", error);
             toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover a ferramenta "${toolName}": ${error.message}`,
                variant: "destructive",
            });
         } finally {
             setIsDeleting(false);
         }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                 {/* Form fields are the same as AddToolForm, but pre-filled */}
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

                 {/* Action Buttons */}
                <div className="flex justify-between items-center gap-2 mt-6 pt-4 border-t border-border">
                     {/* Delete Button with Confirmation */}
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="flex items-center gap-2" disabled={isSubmitting || isDeleting}>
                                <Trash2 className="h-4 w-4" />
                                {isDeleting ? "Excluindo..." : "Excluir Ferramenta"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja excluir a ferramenta "{tool.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                     {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                     </AlertDialog>

                    {/* Cancel and Save Buttons */}
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setSection('manage-tools')} disabled={isSubmitting || isDeleting}>
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
