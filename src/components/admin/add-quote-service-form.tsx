
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

interface AddQuoteServiceFormProps {
    setSection: (section: any) => void;
}

export const quoteServiceSchema = z.object({
    title: z.string().min(3, { message: "Título deve ter pelo menos 3 caracteres." }),
    description: z.string().min(10, { message: "Descrição deve ter pelo menos 10 caracteres." }),
    imageUrl: z.string().url({ message: "Por favor, insira uma URL de imagem válida." }),
});

export type QuoteServiceFormData = z.infer<typeof quoteServiceSchema>;

export default function AddQuoteServiceForm({ setSection }: AddQuoteServiceFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<QuoteServiceFormData>({
        resolver: zodResolver(quoteServiceSchema),
        defaultValues: {
            title: "",
            description: "",
            imageUrl: "",
        },
    });

    async function onSubmit(values: QuoteServiceFormData) {
        if (!db) {
            toast({
                title: "Erro de Conexão",
                description: "Não foi possível conectar ao banco de dados.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);

        try {
            await addDoc(collection(db, "quoteServices"), {
                ...values,
                createdAt: serverTimestamp(),
            });

            toast({
                title: "Serviço Adicionado!",
                description: `O serviço "${values.title}" foi criado com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });

            form.reset();
            setSection('manage-quotes');

        } catch (error: any) {
            console.error("Error adding quote service: ", error);
            toast({
                title: "Erro ao Adicionar Serviço",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
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
                    name="imageUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">URL da Imagem de Capa</FormLabel>
                            <FormControl>
                                <Input placeholder="https://exemplo.com/imagem.png" {...field} className="bg-input" />
                            </FormControl>
                             <FormDescription className="text-xs text-muted-foreground">
                                Cole o link para a imagem que representará o serviço.
                             </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="secondary" onClick={() => setSection('manage-quotes')} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Adicionar Serviço"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
