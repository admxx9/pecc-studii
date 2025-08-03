
'use client';

import React, { useState, useEffect } from 'react';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, Trash2, Plus, AlertTriangle, Ticket, Loader2, RefreshCw } from 'lucide-react';
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
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Schema for generating a code - Added customCode field
const generateCodeSchema = z.object({
    planType: z.enum(['basic', 'pro'], { required_error: "Selecione o tipo do plano." }),
    durationDays: z.coerce.number().int().min(1, { message: "Duração deve ser pelo menos 1 dia." }).max(365, { message: "Duração máxima de 365 dias." }),
    quantity: z.coerce.number().int().min(1, {message: "Quantidade deve ser pelo menos 1."}).max(50, {message: "Máximo de 50 códigos por vez."}),
    customCode: z.string().optional(), // Optional custom code input
});

type GenerateCodeFormData = z.infer<typeof generateCodeSchema>;

// Interface for a code stored in Firestore
interface RedemptionCode {
    id: string;
    code: string;
    planType: 'basic' | 'pro';
    durationDays: number;
    createdAt: any; // Firestore Timestamp
    status: 'active' | 'redeemed';
    redeemedByUserId?: string | null;
    redeemedAt?: any | null; // Firestore Timestamp
}

interface ManageCodesProps {
    setSection: (section: any) => void; // Keep type simple for now
}

const ManageCodes = ({ setSection }: ManageCodesProps) => {
    const [codes, setCodes] = useState<RedemptionCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [codeToDelete, setCodeToDelete] = useState<RedemptionCode | null>(null);
    const { toast } = useToast();

    const form = useForm<GenerateCodeFormData>({
        resolver: zodResolver(generateCodeSchema),
        defaultValues: {
            planType: 'basic',
            durationDays: 30,
            quantity: 1,
            customCode: "", // Default empty custom code
        },
    });

    // Generate a random code (simple example)
    const generateRandomCode = (length = 12): string => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        // Optionally add hyphens for readability e.g., XXXX-XXXX-XXXX
        return result.match(/.{1,4}/g)?.join('-') || result;
    };

    // Fetch existing codes
    const fetchCodes = async () => {
        if (!db) {
            setError("Erro de conexão com o banco de dados.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const codesCol = collection(db, "redemptionCodes");
            const codesQuery = query(codesCol, orderBy("createdAt", "desc"));
            const codesSnapshot = await getDocs(codesQuery);

            const fetchedCodes = codesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RedemptionCode[];
            setCodes(fetchedCodes);
        } catch (e: any) {
            console.error("Error fetching codes: ", e);
            setError(`Erro ao carregar códigos: ${e.message || 'Erro desconhecido'}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch codes on mount
    useEffect(() => {
        fetchCodes();
    }, []);

    // Handle code generation form submission
    const onGenerateSubmit = async (values: GenerateCodeFormData) => {
        if (!db) {
            toast({ title: "Erro", description: "Banco de dados não disponível.", variant: "destructive" });
            return;
        }
        setIsGenerating(true);
        // Always use the provided quantity, even with a custom code
        const codesToGenerate = values.quantity;
        const generatedCodes: string[] = [];

        try {
             const codesToAdd = [];
             for (let i = 0; i < codesToGenerate; i++) {
                 // Use custom code if provided and valid, otherwise generate random
                 const newCode = values.customCode && values.customCode.trim() ? values.customCode.trim().toUpperCase() : generateRandomCode();
                 // TODO: Add validation here to check if customCode already exists in Firestore before adding

                 codesToAdd.push({
                     code: newCode,
                     planType: values.planType,
                     durationDays: values.durationDays,
                     createdAt: serverTimestamp(),
                     status: 'active',
                     redeemedByUserId: null,
                     redeemedAt: null,
                 });
                 // Only add the first generated code to the list for the toast if custom,
                 // otherwise add all random codes.
                 if (values.customCode || generatedCodes.length < 5) { // Limit shown codes in toast
                     generatedCodes.push(newCode);
                 } else if (generatedCodes.length === 5) {
                     generatedCodes.push('...'); // Indicate more codes were generated
                 }
             }

             // Add codes to Firestore
             for (const codeData of codesToAdd) {
                  await addDoc(collection(db, "redemptionCodes"), codeData);
             }

            toast({
                 title: `${codesToGenerate} Código(s) Gerado(s)!`,
                 description: `Código(s): ${generatedCodes.join(', ')}. Tipo: ${values.planType}, Duração: ${values.durationDays} dias.`,
                 variant: 'default',
                 className: 'bg-green-600 border-green-600 text-white',
                 duration: 5000, // Show toast a bit longer
            });

            form.reset(); // Reset form
            fetchCodes(); // Refresh the list

        } catch (error: any) {
            console.error("Error generating code(s): ", error);
            toast({
                title: "Erro ao Gerar Código(s)",
                description: error.message || "Ocorreu um erro.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

     // Handle copying code to clipboard
    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            toast({ title: "Código Copiado!", description: code });
            setTimeout(() => setCopiedCode(null), 1500); // Reset icon after 1.5s
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            toast({ title: "Erro", description: "Não foi possível copiar o código.", variant: "destructive"});
        });
    };

     // Handle deletion confirmation
    const handleDeleteClick = (code: RedemptionCode) => {
        setCodeToDelete(code);
    };

     // Confirm and delete code
    const confirmDelete = async () => {
        if (!codeToDelete || !db) return;

        const codeId = codeToDelete.id;
        const codeValue = codeToDelete.code; // For toast message

        try {
            const codeDocRef = doc(db, "redemptionCodes", codeId);
            await deleteDoc(codeDocRef);

            // Update local state
            setCodes(prevCodes => prevCodes.filter(c => c.id !== codeId));
            setCodeToDelete(null); // Close dialog

            toast({
                title: "Código Excluído!",
                description: `O código "${codeValue}" foi removido.`,
                variant: "default",
            });

        } catch (e: any) {
            console.error("Error deleting code: ", e);
            toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover o código "${codeValue}": ${e.message}`,
                variant: "destructive",
            });
            setCodeToDelete(null); // Close dialog even on error
        }
    };

    return (
        <div className="space-y-6">
            {/* Code Generation Form */}
            <Card className="bg-secondary/50 border-border">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">Gerar Novos Códigos</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">Configure e gere códigos de resgate para planos premium.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onGenerateSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                             {/* Custom Code Input */}
                             <FormField
                                control={form.control}
                                name="customCode"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2 lg:col-span-1">
                                        <FormLabel className="text-foreground">Código Personalizado (Opcional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ex: MEUCODIGO123"
                                                 {...field}
                                                 className="bg-input uppercase" // Force uppercase maybe?
                                                 onChange={(e) => field.onChange(e.target.value.toUpperCase())} // Convert input to uppercase
                                            />
                                        </FormControl>
                                        <FormDescription className="text-xs text-muted-foreground">Deixe em branco para gerar aleatoriamente.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="planType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground">Tipo do Plano</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-input">
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="basic">Básico</SelectItem>
                                                <SelectItem value="pro">Pro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="durationDays"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground">Duração (Dias)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="Ex: 30" {...field} className="bg-input" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {/* Quantity - No longer disabled when custom code is entered */}
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground">Quantidade</FormLabel>
                                        <FormControl>
                                            <Input
                                                 type="number"
                                                 placeholder="Ex: 10"
                                                 {...field}
                                                 className="bg-input"
                                            />
                                        </FormControl>
                                        {/* Removed the conditional description */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground md:mt-auto" disabled={isGenerating}>
                                {isGenerating ? (
                                     <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                                     </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" /> Gerar Código(s)
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* List of Existing Codes */}
             <Card className="border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle className="text-lg font-semibold text-foreground">Códigos Gerados</CardTitle>
                        <CardDescription className="text-muted-foreground text-sm">Visualize e gerencie os códigos existentes.</CardDescription>
                     </div>
                     <Button variant="outline" size="icon" onClick={fetchCodes} disabled={isLoading} title="Atualizar Lista">
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                </CardHeader>
                 <CardContent>
                    <div className="overflow-x-auto border rounded-md border-border">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Plano</TableHead>
                                    <TableHead>Duração</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado em</TableHead>
                                    <TableHead>Resgatado por</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={`skel-${i}`}>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-destructive">
                                             <div className="flex flex-col items-center justify-center">
                                                 <AlertTriangle className="w-8 h-8 mb-2" />
                                                {error}
                                             </div>
                                        </TableCell>
                                    </TableRow>
                                ) : codes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                             <div className="flex flex-col items-center justify-center">
                                                <Ticket className="w-8 h-8 mb-2" />
                                                Nenhum código gerado ainda.
                                             </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    codes.map((code) => (
                                        <TableRow key={code.id} className={cn(code.status === 'redeemed' && 'opacity-60')}>
                                            <TableCell className="font-mono text-xs text-foreground flex items-center gap-2">
                                                {code.code}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleCopyCode(code.code)}
                                                >
                                                    {copiedCode === code.code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                 <Badge variant={code.planType === 'pro' ? 'default' : 'secondary'} className="capitalize text-xs">
                                                    {code.planType}
                                                 </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{code.durationDays} dias</TableCell>
                                             <TableCell>
                                                <Badge variant={code.status === 'active' ? 'outline' : 'destructive'} className="capitalize text-xs">
                                                     {code.status === 'active' ? 'Ativo' : 'Resgatado'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                 {code.createdAt?.toDate ? code.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                             <TableCell className="text-muted-foreground text-xs">
                                                {code.redeemedByUserId ? code.redeemedByUserId.substring(0, 8) + '...' : '-'}
                                                {code.redeemedAt && ` em ${code.redeemedAt.toDate().toLocaleDateString()}`}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive border-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteClick(code)}
                                                            title="Excluir Código"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                 Tem certeza que deseja excluir o código "{codeToDelete?.code}"? Esta ação não pode ser desfeita.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setCodeToDelete(null)}>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                 </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {codes.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Exibindo {codes.length} código(s).
                        </p>
                    )}
                </CardContent>
             </Card>
        </div>
    );
};

export default ManageCodes;
