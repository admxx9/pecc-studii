
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2 } from 'lucide-react';
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
import type { QuoteService } from '@/components/layout/shop-content';
import { quoteServiceSchema, QuoteServiceFormData } from './add-quote-service-form';

interface EditQuoteServiceFormProps {
    setSection: (section: any) => void;
    quoteService: QuoteService;
}

export default function EditQuoteServiceForm({ setSection, quoteService }: EditQuoteServiceFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const form = useForm<QuoteServiceFormData>({
        resolver: zodResolver(quoteServiceSchema),
        defaultValues: {
            title: quoteService.title || "",
            description: quoteService.description || "",
            icon: quoteService.icon || "Bot",
        },
    });

    async function onSubmit(values: QuoteServiceFormData) {
        if (!db || !quoteService.id) {
            toast({ title: "Erro Interno", description: "ID do serviço inválido.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        const serviceDocRef = doc(db, "quoteServices", quoteService.id);

        try {
            await updateDoc(serviceDocRef, values);
            toast({
                title: "Serviço Atualizado!",
                description: `O serviço "${values.title}" foi atualizado com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });
            setSection('manage-quotes');
        } catch (error: any) {
            console.error("Error updating quote service: ", error);
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
        if (!db || !quoteService.id) {
            toast({ title: "Erro", description: "Não foi possível identificar o serviço para excluir.", variant: "destructive" });
            return;
        }
        setIsDeleting(true);
        const serviceDocRef = doc(db, "quoteServices", quoteService.id);

        try {
            await doc(serviceDocRef).delete();
            toast({
                title: "Serviço Excluído!",
                description: `O serviço "${quoteService.title}" foi removido com sucesso.`,
                variant: "default",
            });
            setSection('manage-quotes');
        } catch (error: any) {
            console.error("Error deleting service: ", error);
            toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover o serviço: ${error.message}`,
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
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Título do Serviço</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Conversão de Mapa: GTA V" {...field} className="bg-input" />
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
                                <Textarea placeholder="Descreva o serviço oferecido..." {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Nome do Ícone (Lucide)</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Bot, Car, Map" {...field} className="bg-input" />
                            </FormControl>
                            <FormDescription className="text-xs text-muted-foreground">
                                Use um nome de ícone válido da biblioteca <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline">Lucide React</a>.
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
                                {isDeleting ? "Excluindo..." : "Excluir Serviço"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja excluir o serviço "{quoteService.title}"? Esta ação não pode ser desfeita.
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
                        <Button type="button" variant="secondary" onClick={() => setSection('manage-quotes')} disabled={isSubmitting || isDeleting}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isDeleting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    );
}
