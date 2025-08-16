
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormDescription,
    FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

interface SettingsPanelProps {
    setSection: (section: any) => void;
}

// Updated schema to include the sales bot setting
const settingsSchema = z.object({
    isMaintenanceMode: z.boolean().default(false),
    maintenanceMessage: z.string().min(10, { message: "A mensagem deve ter pelo menos 10 caracteres." }).max(200, { message: "A mensagem não pode exceder 200 caracteres." }),
    isSalesBotEnabled: z.boolean().default(true), // Add the bot toggle
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const SettingsPanel = ({ setSection }: SettingsPanelProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            isMaintenanceMode: false,
            maintenanceMessage: 'O site está em manutenção no momento. Por favor, tente novamente mais tarde.',
            isSalesBotEnabled: true, // Default to enabled
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) {
                toast({ title: "Erro de Conexão", description: "Não foi possível carregar as configurações.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const settingsDocRef = doc(db, 'settings', 'site_config');
            try {
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    // Reset form with fetched data, providing defaults for any missing fields
                    const data = docSnap.data();
                    form.reset({
                        isMaintenanceMode: data.isMaintenanceMode || false,
                        maintenanceMessage: data.maintenanceMessage || 'O site está em manutenção. Voltamos em breve.',
                        isSalesBotEnabled: data.isSalesBotEnabled === undefined ? true : data.isSalesBotEnabled,
                    });
                }
            } catch (error: any) {
                console.error("Error fetching settings:", error);
                toast({ title: "Erro", description: "Não foi possível carregar as configurações do site.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [form, toast]);

    const onSubmit = async (values: SettingsFormData) => {
        if (!db) {
            toast({ title: "Erro de Conexão", description: "Não foi possível salvar as configurações.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        const settingsDocRef = doc(db, 'settings', 'site_config');
        try {
            await setDoc(settingsDocRef, values, { merge: true });
            toast({
                title: "Configurações Salvas!",
                description: "As configurações do site foram atualizadas com sucesso.",
                variant: 'default',
                className: "bg-green-600 border-green-600 text-white"
            });
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast({ title: "Erro ao Salvar", description: `Não foi possível salvar as configurações: ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Carregando configurações...</p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Maintenance Mode Card */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle>Modo Manutenção</CardTitle>
                        <CardDescription>
                            Ative para colocar o site offline para usuários comuns. Apenas administradores poderão acessar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="isMaintenanceMode"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-secondary/50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base text-foreground">
                                            Ativar Modo Manutenção
                                        </FormLabel>
                                        <FormDescription className="text-muted-foreground text-xs">
                                            Se ativado, apenas administradores podem fazer login.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            aria-label="Ativar Modo Manutenção"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maintenanceMessage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">Mensagem de Manutenção</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Digite a mensagem que será exibida aos usuários..."
                                            {...field}
                                            className="bg-input min-h-[100px]"
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormDescription className="text-muted-foreground text-xs">
                                        Esta mensagem será exibida na tela de manutenção.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Sales Bot Card */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle>Automação de Vendas</CardTitle>
                        <CardDescription>
                            Controle o comportamento do assistente virtual no chat de consulta de vendas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="isSalesBotEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-secondary/50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base text-foreground">
                                            Ativar Assistente de Vendas (Bot)
                                        </FormLabel>
                                        <FormDescription className="text-muted-foreground text-xs">
                                            Se ativado, o bot enviará uma mensagem interativa ao criar uma consulta.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            aria-label="Ativar Assistente de Vendas"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSubmitting ? "Salvando..." : "Salvar Todas as Configurações"}
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default SettingsPanel;
