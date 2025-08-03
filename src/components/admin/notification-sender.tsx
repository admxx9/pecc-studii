
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // For target selection
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // For type selection
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; // Removed unused query imports
import { useToast } from "@/hooks/use-toast";
import { Send, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from "@/lib/utils"; // Import cn

// Define notification types and their colors/icons
const notificationTypes = [
    { id: 'info', name: 'Informativo', color: 'blue-500', icon: Info },
    { id: 'success', name: 'Sucesso', color: 'green-600', icon: CheckCircle },
    { id: 'warning', name: 'Atenção', color: 'yellow-500', icon: AlertTriangle },
    { id: 'urgent', name: 'Urgente', color: 'red-600', icon: AlertTriangle }, // Reusing AlertTriangle for urgent
];
const typeIds = notificationTypes.map(type => type.id) as [string, ...string[]]; // For Zod enum

// Define Zod schema for notification form validation using targetUserEmail
const notificationSchema = z.object({
    title: z.string().min(5, { message: "Título deve ter pelo menos 5 caracteres." }).max(100, { message: "Título não pode exceder 100 caracteres." }),
    message: z.string().min(10, { message: "Mensagem deve ter pelo menos 10 caracteres." }).max(500, { message: "Mensagem não pode exceder 500 caracteres." }),
    targetType: z.enum(['global', 'specific'], { required_error: "Selecione o tipo de alvo." }),
    targetUserEmail: z.string().email({ message: "Por favor, insira um email válido." }).optional().or(z.literal('')), // Allow empty string or valid email
    type: z.enum(typeIds, { required_error: "Selecione o tipo de notificação." }),
}).refine(data => data.targetType === 'global' || (data.targetType === 'specific' && data.targetUserEmail && data.targetUserEmail.trim().length > 0), {
    message: "Email do Usuário é obrigatório para envio específico.", // Updated validation message
    path: ["targetUserEmail"], // Apply error to targetUserEmail field
});


type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationSenderProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings') => void; // Added manage-lessons etc.
}

export default function NotificationSender({ setSection }: NotificationSenderProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<NotificationFormData>({
        resolver: zodResolver(notificationSchema),
        defaultValues: {
            title: "",
            message: "",
            targetType: 'global',
            targetUserEmail: "", // Default User Email is empty
            type: 'info',
        },
    });

    const targetType = form.watch('targetType'); // Watch targetType changes

    // Function to handle form submission and save notification to Firestore
    async function onSubmit(values: NotificationFormData) {
        if (!db) {
            toast({ title: "Erro de Conexão", description: "Banco de dados indisponível.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        console.log("Submitting notification values:", values);

        // Construct notification data based on target type
        const notificationData = {
            title: values.title,
            message: values.message,
            type: values.type,
            read: false, // Default read status
            createdAt: serverTimestamp(),
            target: values.targetType, // 'global' or 'specific'
            // Explicitly set targetUserEmail to null if the targetType is 'global'
            targetUserEmail: values.targetType === 'specific' ? values.targetUserEmail : null,
            targetUserId: null, // Keep targetUserId as null since we primarily use email now
        };

        console.log("Saving notification data:", notificationData);

        try {
            // Add the new notification document to the 'notifications' collection
            await addDoc(collection(db, "notifications"), notificationData);

            toast({
                title: "Notificação Enviada!",
                description: `A notificação "${values.title}" (${values.targetType}) foi enviada com sucesso.`,
                variant: "default",
                className: "bg-green-600 border-green-600 text-white"
            });

            form.reset(); // Reset form fields
             // Optionally navigate back or stay on the form
             // setSection('overview');

        } catch (error: any) {
            console.error("Error sending notification: ", error);
            toast({
                title: "Erro ao Enviar Notificação",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4"> {/* Increased gap */}

                {/* Notification Content */}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Título da Notificação</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Nova Aula Disponível!" {...field} className="bg-input" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Mensagem</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Descreva a notificação aqui..." {...field} className="bg-input min-h-[100px]" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Notification Type */}
                 <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Tipo/Urgência</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-input">
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {notificationTypes.map(type => {
                                        const Icon = type.icon;
                                        return (
                                            <SelectItem key={type.id} value={type.id}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className={cn("h-4 w-4", `text-${type.color}`)} /> {/* Apply color class */}
                                                    {type.name}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Target Selection */}
                <FormField
                    control={form.control}
                    name="targetType"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel className="text-foreground">Enviar Para</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        // Clear email field if switching to global
                                        if (value === 'global') {
                                            form.setValue('targetUserEmail', '');
                                        }
                                    }}
                                    defaultValue={field.value}
                                    className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                                >
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value="global" />
                                        </FormControl>
                                        <FormLabel className="font-normal text-foreground">
                                            Global (Todos Usuários)
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value="specific" />
                                        </FormControl>
                                        <FormLabel className="font-normal text-foreground">
                                            Usuário Específico (por Email) {/* Updated Label */}
                                        </FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Specific User Email Input (conditional) */}
                {targetType === 'specific' && (
                    <FormField
                        control={form.control}
                        name="targetUserEmail" // Changed name to targetUserEmail
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Email do Usuário Alvo</FormLabel> {/* Updated Label */}
                                <FormControl>
                                    <Input
                                        placeholder="Digite o email do usuário..." // Updated placeholder
                                        type="email" // Set input type to email
                                        {...field}
                                        className="bg-input"
                                     />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="secondary" onClick={() => setSection('overview')} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2" disabled={isSubmitting}>
                         <Send className="h-4 w-4" />
                        {isSubmitting ? "Enviando..." : "Enviar Notificação"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
