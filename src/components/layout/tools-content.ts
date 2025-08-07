// src/components/layout/tools-content.ts

// Define the Tool interface based on Firestore data
export interface Tool {
    id: string;
    name: string;
    description: string;
    downloadUrl: string;
    version: string;
    size: string;
    category: string; // e.g., 'mapas', 'texturas', 'scripts', 'modelos', 'geral', 'loja'
    requiredPlan?: 'none' | 'basic' | 'pro' | null;
    createdAt?: any; // Optional Firestore Timestamp
    images?: string[]; // Optional: Array of image URLs
    specifications?: { [key: string]: string };
    price?: number; // Optional: for 'loja' category
    tags?: string[]; // Optional: for 'loja' category filtering
}
