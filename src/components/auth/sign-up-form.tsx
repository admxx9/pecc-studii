
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"; // Import updateProfile
import { auth, db } from "@/lib/firebase"; // Import db
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // Import doc and setDoc
import { useToast } from "@/hooks/use-toast";

interface SignUpFormProps {
  setOpen: (open: boolean) => void; // Function to close the dialog
}

export default function SignUpForm({ setOpen }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
   const [displayName, setDisplayName] = useState(""); // Add state for display name
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Add submitting state
  const { toast } = useToast();

  async function handleSignUp() {
    setError("");
    setIsSubmitting(true); // Start submitting

    // Basic validation
    if (!email || !password || !confirmPassword || !displayName) {
      setError("Por favor, preencha todos os campos.");
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        setIsSubmitting(false);
        return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setIsSubmitting(false);
      return;
    }
    if (!auth || !db) { // Check if db is also available
      setError("Erro de configuração. Tente novamente mais tarde.");
      setIsSubmitting(false);
      return;
    }

    const standardAvatarUrl = 'https://i.ibb.co/VGBd4FG/Chat-GPT-Image-2-de-ago-de-2025-15-33-39.png'; // Define standard avatar URL
    const defaultBannerUrl = 'https://i.imgur.com/VmlfAGR.jpeg'; // Define default banner URL

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("User created in Auth:", user.uid);

       // 2. Update Firebase Auth profile (optional, but good practice)
       try {
           await updateProfile(user, { displayName: displayName, photoURL: standardAvatarUrl });
           console.log("Firebase Auth profile updated with displayName and standard avatar.");
       } catch (profileError: any) {
            console.warn("Could not update Firebase Auth profile:", profileError);
            // Don't block Firestore creation for this, but log it
       }


      // 3. Create user document in Firestore 'users' collection
      const userDocRef = doc(db, "users", user.uid); // Use user's UID as document ID
      await setDoc(userDocRef, {
        uid: user.uid, // Store UID
        email: user.email,
        displayName: displayName, // Use the name from the form
        photoURL: standardAvatarUrl, // Use the standard avatar URL
        rank: 'iniciante', // Default rank
        isAdmin: false, // Default admin status
        isPremium: false, // Default premium status
        bannerURL: defaultBannerUrl, // Default bannerURL
        createdAt: serverTimestamp(), // Timestamp of creation
      });
      console.log("User document created in Firestore:", userDocRef.id);


      // User will be logged in automatically via onAuthStateChanged in page.tsx
      toast({
          title: "Conta criada com sucesso!",
          description: `Bem-vindo, ${displayName}!`,
          variant: "default",
          className: "bg-green-600 border-green-600 text-white"
        });
      setOpen(false); // Close the dialog on success

    } catch (error: any) {
      console.error("Signup Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError("Este email já está em uso.");
      } else if (error.code === 'auth/weak-password') {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else if (error.code === 'auth/invalid-email') {
         setError("O formato do email é inválido.");
      } else if (error.code === 'permission-denied') {
           setError("Erro de permissão ao salvar perfil. Contacte o suporte.");
           console.error("Firestore permission denied. Check rules for writing to 'users' collection.");
      }
       else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
        setIsSubmitting(false); // Stop submitting
    }
  }

  return (
    <DialogContent className="sm:max-w-[425px] bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">Criar Conta</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Preencha os campos abaixo para criar sua conta na STUDIO PECC. {/* Updated text */}
        </DialogDescription>
      </DialogHeader>
      {error && <div className="bg-destructive/10 text-destructive border border-destructive/30 p-3 rounded-md mb-4 text-sm flex items-center">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
         {error}
      </div>}
      <div className="grid gap-4 py-4">
         {/* Display Name Field */}
         <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="displayName-signup" className="text-right text-foreground">
            Nome
          </Label>
          <Input
            id="displayName-signup"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome ou nick"
            className="col-span-3 bg-input border-border focus:ring-primary focus:border-primary"
            required
          />
        </div>
        {/* Email Field */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="email-signup" className="text-right text-foreground">
            Email
          </Label>
          <Input
            id="email-signup"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com"
            className="col-span-3 bg-input border-border focus:ring-primary focus:border-primary"
            required
          />
        </div>
         {/* Password Field */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="password-signup" className="text-right text-foreground">
            Senha
          </Label>
          <Input
            id="password-signup"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Pelo menos 6 caracteres"
            className="col-span-3 bg-input border-border focus:ring-primary focus:border-primary"
            required
          />
        </div>
        {/* Confirm Password Field */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="confirm-password-signup" className="text-right text-foreground">
            Confirmar Senha
          </Label>
          <Input
            id="confirm-password-signup"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a senha"
            className="col-span-3 bg-input border-border focus:ring-primary focus:border-primary"
            required
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={isSubmitting}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="button" onClick={handleSignUp} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Criar Conta"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
