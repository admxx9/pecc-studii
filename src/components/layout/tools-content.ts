
// src/components/layout/tools-content.ts

// Define the Tool interface based on Firestore data
export interface Tool {
    id: string;
    name: string;
    description: string;
    downloadUrl: string;
    version: string;
    size: string;
    category: string; // e.g., 'mapas', 'texturas', 'scripts', 'modelos', 'geral'
    requiredPlan?: 'none' | 'basic' | 'pro' | null; // 'none' for free, 'basic', 'pro'
    createdAt?: any; // Optional Firestore Timestamp
    images?: string[]; // Optional: Array of image URLs
    specifications?: { [key: string]: string }; // Key-value pairs for specs
}
