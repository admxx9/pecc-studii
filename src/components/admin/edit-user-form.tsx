
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch"; // Still needed for isAdmin
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription, // Import FormDescription
} from "@/components/ui/form";
import {
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"; // Import serverTimestamp if needed for expiry
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from './manage-users'; // Import UserProfile type
import { ranks, rankKeys } from '@/config/ranks'; // Import ranks and rankKeys from config file
import { updateProfile } from 'firebase/auth';

interface EditUserFormProps {
    user: UserProfile;
    onUpdateSuccess: (updatedData: Partial<UserProfile>) => void;
    setOpen: (open: boolean) => void;
}

// Zod schema for validation - added premiumPlanType, removed isPremium
const editUserSchema = z.object({
    displayName: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres." }).max(50, { message: "Nome não pode exceder 50 caracteres."}),
    rank: z.enum(rankKeys, { required_error: "Selecione uma patente." }),
    isAdmin: z.boolean(),
    premiumPlanType: z.enum(['none', 'basic', 'pro']).optional().default('none'), // Added premium plan type (none, basic, pro)
    // Removed isPremium from validation
});

type EditUserFormData = z.infer<typeof editUserSchema>;

export default function EditUserForm({ user, onUpdateSuccess, setOpen }: EditUserFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            displayName: user.displayName || "",
            rank: user.rank || "iniciante",
            isAdmin: user.isAdmin || false,
            premiumPlanType: user.premiumPlanType || 'none', // Pre-fill with current plan or 'none'
        },
    });

    async function onSubmit(values: EditUserFormData) {
        if (!db || !user.id) {
            toast({ title: "Erro", description: "Usuário ou conexão inválida.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);

        const userDocRef = doc(db, "users", user.id);
        const firestoreUpdates: { [key: string]: any } = {};

        // Basic fields
        firestoreUpdates.displayName = values.displayName;
        firestoreUpdates.rank = values.rank;
        firestoreUpdates.isAdmin = values.isAdmin;

        // Handle premium status based on plan selection
        const newPlanType = values.premiumPlanType === 'none' ? null : values.premiumPlanType;
        firestoreUpdates.premiumPlanType = newPlanType;
        const newIsPremium = !!newPlanType;
        firestoreUpdates.isPremium = newIsPremium; // Set isPremium to true if plan is basic or pro

        const standardAvatarUrl = 'https://i.ibb.co/VGBd4FG/Chat-GPT-Image-2-de-ago-de-2025-15-33-39.png';
        const premiumAvatarUrl = 'https://i.ibb.co/M3T30ZJ/download-1.jpg';
        const newAvatarUrl = newIsPremium ? premiumAvatarUrl : standardAvatarUrl;

        firestoreUpdates.photoURL = newAvatarUrl;

        // Clear expiry date if setting plan to none
        if (!newPlanType) {
            firestoreUpdates.premiumExpiryDate = null;
        }
        // Note: We don't set expiry date here when assigning a plan,
        // as this form is for manual override. Expiry comes from codes.
        
        let authProfileUpdates: { displayName?: string, photoURL?: string } = {};
        if (values.displayName !== user.displayName) authProfileUpdates.displayName = values.displayName;
        if (newAvatarUrl !== user.photoURL) authProfileUpdates.photoURL = newAvatarUrl;


        try {
             // Only update Auth profile if there are changes to displayName or photoURL
             if (Object.keys(authProfileUpdates).length > 0 && auth.currentUser && auth.currentUser.uid === user.id) {
                await updateProfile(auth.currentUser, authProfileUpdates);
            }

            await updateDoc(userDocRef, {
                ...firestoreUpdates // Spread all updates
            });

            // Call the callback function passed from parent
            // Pass back all fields that were edited in this form
            onUpdateSuccess({
                displayName: firestoreUpdates.displayName,
                rank: firestoreUpdates.rank,
                isAdmin: firestoreUpdates.isAdmin,
                premiumPlanType: firestoreUpdates.premiumPlanType,
                isPremium: firestoreUpdates.isPremium,
                photoURL: firestoreUpdates.photoURL,
                premiumExpiryDate: firestoreUpdates.premiumExpiryDate,
            });
            // Parent component (ManageUsers) will handle closing the dialog and showing toast

        } catch (error: any) {
            console.error("Error updating user: ", error);
            toast({
                title: "Erro ao Atualizar",
                description: `Ocorreu um erro: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-foreground">Editar Usuário: {user.displayName}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                    Atualize nome, patente, status de admin e tipo de plano premium.
                </DialogDescription>
            </DialogHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Nome de Exibição</FormLabel>
                                <FormControl>
                                    <Input placeholder="Nome ou nick" {...field} className="bg-input" disabled={isSubmitting}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="rank"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Patente</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                                    <FormControl>
                                        <SelectTrigger className="bg-input">
                                            <SelectValue placeholder="Selecione a patente" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(ranks).map(([key, name]) => (
                                            <SelectItem key={key} value={key}>
                                                {name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="isAdmin"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-secondary/50">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-foreground">Administrador</FormLabel>
                                    <FormMessage />
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        aria-label="Marcar como administrador"
                                        disabled={isSubmitting}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                        />

                      {/* Premium Plan Type Selection */}
                     <FormField
                        control={form.control}
                        name="premiumPlanType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Plano Premium</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isSubmitting}>
                                    <FormControl>
                                        <SelectTrigger className="bg-input">
                                            <SelectValue placeholder="Selecione o plano" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhum (Remover Premium)</SelectItem>
                                        <SelectItem value="basic">Básico</SelectItem>
                                        <SelectItem value="pro">Pro</SelectItem>
                                    </SelectContent>
                                </Select>
                                 <FormDescription className="text-xs text-muted-foreground">
                                     Definir um plano ativa o status Premium. A data de expiração é definida pelo código resgatado.
                                 </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={isSubmitting}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                            {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}
