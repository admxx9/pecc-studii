'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
    FormDescription,
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Star } from 'lucide-react';
import { toolCategories, toolFormSchema, ToolFormData } from './add-tool-form';
import type { Tool } from '@/components/layout/tools-content';
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
import { cn } from '@/lib/utils';


interface EditToolFormProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings' | 'manage-codes') => void;
    tool: Tool;
}

export default function EditToolForm({ setSection, tool }: EditToolFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const form = useForm<ToolFormData>({
        resolver: zodResolver(toolFormSchema),
        defaultValues: {
            name: tool.name || "",
            description: tool.description || "",
            downloadUrl: tool.downloadUrl || "",
            version: tool.version || "",
            size: tool.size || "",
            category: tool.category || undefined,
            requiredPlan: tool.requiredPlan || 'none',
            images: tool.images?.join('\n') || "",
            price: tool.price || 0,
            tags: tool.tags?.join(', ') || "",
        },
    });
    
    // Watch the category field to conditionally show Loja-specific fields
    const selectedCategory = form.watch('category');

    async function onSubmit(values: ToolFormData) {
        if (!db || !tool || !tool.id) {
             toast({ title: "Erro Interno", description: "ID da ferramenta inválido.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);

        const imageArray = values.images?.split('\n').map(url => url.trim()).filter(url => url) || [];
        const tagsArray = values.tags?.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) || [];

        const dataToUpdate: any = {
            name: values.name,
            description: values.description,
            downloadUrl: values.downloadUrl,
            version: values.version,
            size: values.size,
            category: values.category,
            requiredPlan: values.requiredPlan,
            images: imageArray,
        };

        if (values.category === 'loja') {
            dataToUpdate.price = values.price || 0;
            dataToUpdate.tags = tagsArray;
        } else {
             // If category is not 'loja', ensure price and tags are removed or nullified
            dataToUpdate.price = null;
            dataToUpdate.tags = [];
        }

        const toolDocRef = doc(db, "tools", tool.id);

        try {
            await updateDoc(toolDocRef, dataToUpdate);

            toast({
                title: "Ferramenta Atualizada!",
                description: `A ferramenta "${values.name}" foi atualizada com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });

            setSection('manage-tools');

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

    async function handleDelete() {
         if (!db || !tool || !tool.id) {
            toast({ title: "Erro", description: "Não foi possível identificar a ferramenta para excluir.", variant: "destructive" });
            return;
         }
         setIsDeleting(true);
         const toolDocRef = doc(db, "tools", tool.id);
         const toolName = tool.name;

         try {
            await deleteDoc(toolDocRef);
             toast({
                title: "Ferramenta Excluída!",
                description: `A ferramenta "${toolName}" foi removida com sucesso.`,
                variant: "default",
            });
             setSection('manage-tools');

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
                                    className="bg-input h-24"
                                />
                            </FormControl>
                             <FormDescription className="text-xs text-muted-foreground">
                                Insira as URLs das imagens de pré-visualização da ferramenta, uma por linha.
                             </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300", selectedCategory === 'loja' ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden')}>
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Preço (R$)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" placeholder="Ex: 29.99" {...field} className="bg-input" />
                                </FormControl>
                                <FormDescription className="text-xs text-muted-foreground">
                                   Apenas para itens da categoria 'Loja'. Deixe 0 para grátis.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Tags (separadas por vírgula)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: mapa, favela, pago" {...field} className="bg-input" />
                                </FormControl>
                                 <FormDescription className="text-xs text-muted-foreground">
                                   Para filtrar itens na loja. Ex: mapa, favela, pago, etc.
                                 </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>


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

                <div className="flex justify-between items-center gap-2 mt-6 pt-4 border-t border-border">
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
