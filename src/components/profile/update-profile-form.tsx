
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Loader2 } from 'lucide-react'; // Import Loader2
import { cn } from '@/lib/utils'; // Import cn

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

// Avatars organized by rank
const avatarsByRank: { [key: string]: { id: string; url: string }[] } = {
  iniciante: [
    { id: 'iniciante1', url: 'https://i.imgur.com/D496jwP.png' }, // fundo vermelho
    { id: 'iniciante2', url: 'https://i.imgur.com/WMK9rJs.png' }, // fundo azul
    { id: 'iniciante3', url: 'https://i.imgur.com/BwGqgFs.png' }, // fundo roxo
    { id: 'iniciante4', url: 'https://i.imgur.com/WMK9rJs.png' }, // fundo cinza
  ],
  modder_junior: [
    // Add URLs for Modder Júnior here in the future
  ],
  // Add other ranks as needed
};


// Zod schema for validation
const profileFormSchema = z.object({
    displayName: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres." }).max(50, { message: "Nome não pode exceder 50 caracteres."}),
    photoURL: z.string({ required_error: "Por favor, selecione um avatar." }),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function UpdateProfileForm({ currentUser, currentProfile, onUpdateSuccess, setOpen }: UpdateProfileFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Determine which set of avatars to show
    const availableAvatars = avatarsByRank[currentProfile.rank] || avatarsByRank.iniciante;

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            displayName: currentProfile.displayName || "",
            photoURL: currentProfile.photoURL || availableAvatars[0]?.url || '',
        },
    });


    async function onSubmit(values: ProfileFormData) {
        if (!currentUser?.uid || !auth || !db) {
             toast({ title: "Erro", description: "Usuário ou conexão inválida.", variant: "destructive" });
             return;
        }

        setIsSubmitting(true);

        const updates: Partial<UserProfileData> = {};
        const firestoreUpdates: { [key: string]: any } = {};
        let authProfileUpdates: { displayName?: string, photoURL?: string | null } = {};

        // Handle potentially empty URLs
        const newPhotoUrl = values.photoURL?.trim() || null;

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

            // 2. Update Firestore 'users' document (displayName, photoURL)
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
                     Altere seu nome de exibição e escolha um novo avatar.
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
                                    <Input placeholder="Seu nome ou nick" {...field} className="bg-input" disabled={isSubmitting}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Photo URL Selection Field */}
                     <FormField
                        control={form.control}
                        name="photoURL"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-foreground">Escolha seu Avatar</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="grid grid-cols-5 gap-4" // Changed to 5 columns
                                    >
                                        {availableAvatars.map((avatar) => (
                                            <FormItem key={avatar.id} className="flex items-center justify-center space-x-3 space-y-0">
                                                <Label
                                                     htmlFor={avatar.id}
                                                     className={cn(
                                                        'cursor-pointer rounded-full border-2 border-transparent transition-all',
                                                        field.value === avatar.url && 'ring-2 ring-primary ring-offset-2 border-primary'
                                                     )}
                                                >
                                                    <FormControl>
                                                         <RadioGroupItem value={avatar.url} id={avatar.id} className="sr-only" />
                                                    </FormControl>
                                                     <Image
                                                        src={avatar.url}
                                                        alt={`Avatar ${avatar.id}`}
                                                        width={64}
                                                        height={64}
                                                        className="rounded-full"
                                                        data-ai-hint="avatar gaming"
                                                     />
                                                </Label>
                                            </FormItem>
                                         ))}
                                    </RadioGroup>
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
