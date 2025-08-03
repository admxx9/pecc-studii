
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { auth, db } from "@/lib/firebase"; // Import auth and db
import { updateProfile, User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon } from 'lucide-react'; // Import Loader2 and UserIcon

// Interface now includes bannerURL
interface UserProfileData {
    displayName: string;
    email: string | null;
    photoURL: string | null;
    rank: string;
    isAdmin: boolean;
    isPremium?: boolean;
    bannerURL?: string | null;
}

interface UpdateProfileFormProps {
    currentUser: User;
    currentProfile: UserProfileData;
    onUpdateSuccess: (updatedData: Partial<UserProfileData>) => void;
    setOpen: (open: boolean) => void;
}

// Zod schema for validation - includes photoURL and bannerURL as optional URL strings
const profileFormSchema = z.object({
    displayName: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres." }).max(50, { message: "Nome não pode exceder 50 caracteres."}),
    photoURL: z.string().url({ message: "Por favor, insira uma URL válida para a foto." }).nullable().optional().or(z.literal('')), // Allow empty string, null, or valid URL
    bannerURL: z.string().url({ message: "Por favor, insira uma URL válida para o banner." }).nullable().optional().or(z.literal('')), // Add bannerURL field
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function UpdateProfileForm({ currentUser, currentProfile, onUpdateSuccess, setOpen }: UpdateProfileFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState(currentProfile.photoURL || ""); // State for preview
    const { toast } = useToast();

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            displayName: currentProfile.displayName || "",
            photoURL: currentProfile.photoURL || "", // Pre-fill with current photoURL
            bannerURL: currentProfile.bannerURL || "", // Pre-fill with current bannerURL
        },
    });

     // Update preview URLs when form values change
     useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name === 'photoURL') {
                setPhotoPreviewUrl(value.photoURL || "");
            }
            // Removed bannerURL preview update
        });
        return () => subscription.unsubscribe();
    }, [form]);


    async function onSubmit(values: ProfileFormData) {
        // Ensure currentUser is valid before proceeding
        if (!currentUser?.uid) {
             toast({ title: "Erro", description: "Usuário não identificado.", variant: "destructive" });
             return;
        }
        // Check if auth and db are available
        if (!auth || !db) {
            toast({ title: "Erro", description: "Erro de conexão com serviços Firebase.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        const updates: Partial<UserProfileData> = {};
        const firestoreUpdates: { [key: string]: any } = {};
        let authProfileUpdates: { displayName?: string, photoURL?: string | null } = {};

        // Handle potentially empty URLs
        const newPhotoUrl = values.photoURL?.trim() || null;
        const newBannerUrl = values.bannerURL?.trim() || null; // Keep banner URL processing

        try {
            // Check if displayName changed
            if (values.displayName !== currentProfile.displayName) {
                updates.displayName = values.displayName;
                firestoreUpdates.displayName = values.displayName;
                authProfileUpdates.displayName = values.displayName;
            }

             // Check if photoURL changed
            if (newPhotoUrl !== currentProfile.photoURL) {
                updates.photoURL = newPhotoUrl;
                firestoreUpdates.photoURL = newPhotoUrl;
                authProfileUpdates.photoURL = newPhotoUrl; // Update Auth photoURL as well
            }

            // Check if bannerURL changed
             if (newBannerUrl !== currentProfile.bannerURL) {
                 updates.bannerURL = newBannerUrl;
                 firestoreUpdates.bannerURL = newBannerUrl;
                 // bannerURL is not part of Firebase Auth profile, only Firestore
             }

            // --- Perform Updates (only if needed) ---
            let updated = false;
            // 1. Update Firebase Auth profile (only displayName and photoURL)
            if (Object.keys(authProfileUpdates).length > 0) {
                 if (!auth.currentUser) {
                    throw new Error("Usuário não autenticado para atualizar perfil Auth.");
                 }
                await updateProfile(auth.currentUser, authProfileUpdates);
                console.log("Firebase Auth profile updated.", authProfileUpdates);
                updated = true;
            }

            // 2. Update Firestore 'users' document (displayName, photoURL, bannerURL)
            if (Object.keys(firestoreUpdates).length > 0) {
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, firestoreUpdates);
                console.log("Firestore user document updated.", firestoreUpdates);
                 updated = true;
            }
            // --- End Updates ---


             // Show toast only if something was actually updated
             if (updated) {
                toast({
                    title: "Perfil Atualizado!",
                    description: "Seu perfil foi salvo com sucesso.",
                    variant: "default",
                    className: "bg-green-600 border-green-600 text-white"
                });
                onUpdateSuccess(updates); // Pass the actual updates back
             } else {
                 toast({
                    title: "Nenhuma Alteração",
                    description: "Você não fez nenhuma alteração no perfil.",
                     variant: "default",
                });
                 setOpen(false); // Close dialog even if no changes
             }


        } catch (error: any) {
             console.error("Detailed Error updating profile: ", error);
             let errorMessage = "Ocorreu um erro ao atualizar o perfil.";
             if (error.code?.includes('auth/')) {
                 errorMessage = `Erro ao atualizar autenticação: ${error.message || error.code}`;
             } else if (error.code?.includes('firestore/')) {
                 errorMessage = `Erro ao salvar dados no banco: ${error.message || error.code}`;
             } else {
                 errorMessage = `Erro inesperado: ${error.message || error}`;
             }

            toast({
                title: "Erro ao Atualizar",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-foreground">Editar Perfil</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                     Altere seu nome de exibição, URL da foto e URL do banner.
                </DialogDescription>
            </DialogHeader>

             {/* Previews */}
             <div className="flex flex-col items-center gap-4 mb-4">
                 {/* Avatar Preview */}
                <div className="flex flex-col items-center">
                     <Label className="mb-2 text-xs text-muted-foreground">Prévia Foto de Perfil</Label>
                    <Avatar className="h-20 w-20 border-4 border-background bg-muted shadow-lg">
                        <AvatarImage src={photoPreviewUrl || undefined} alt={currentProfile?.displayName} />
                        <AvatarFallback className="text-2xl">
                            {currentProfile?.displayName ? currentProfile.displayName.substring(0, 2).toUpperCase() : <UserIcon className="h-8 w-8" />}
                        </AvatarFallback>
                    </Avatar>
                </div>
                {/* Banner Preview is removed */}
            </div>


            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Nome de Exibição</FormLabel>
                                <FormControl>
                                    <Input placeholder="Seu nome ou nick" {...field} className="bg-input" disabled={isSubmitting}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Photo URL Input Field */}
                    <FormField
                        control={form.control}
                        name="photoURL"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">URL da Foto de Perfil</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="https://exemplo.com/sua-foto.png"
                                        {...field}
                                        value={field.value ?? ''} // Handle null value for input
                                        className="bg-input"
                                        disabled={isSubmitting}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                     {/* Banner URL Input Field */}
                     <FormField
                        control={form.control}
                        name="bannerURL"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">URL do Banner do Perfil</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="https://exemplo.com/seu-banner.png"
                                        {...field}
                                        value={field.value ?? ''} // Handle null value for input
                                        className="bg-input"
                                        disabled={isSubmitting}
                                    />
                                </FormControl>
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
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[110px]" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Salvar Alterações"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}
