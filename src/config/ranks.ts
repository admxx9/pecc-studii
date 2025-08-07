// src/config/ranks.ts
import { Shield, Star, Crown, Construction, BrainCircuit, Gem } from 'lucide-react';
import React from 'react';

// Define ranks and their display names/descriptions
export const ranks: { [key: string]: string } = {
  iniciante: 'Iniciante',
  modder_junior: 'Modder Júnior',
  modder_pleno: 'Modder Pleno',
  modder_senior: 'Modder Sênior',
  especialista_samp: 'Especialista em SAMP',
  master_modder: 'Master Modder',
  admin: 'Administrador', // Added admin for consistency
};

// Define rank keys for Zod enum
export const rankKeys = Object.keys(ranks).filter(key => key !== 'admin') as [string, ...string[]];

// Define icons for each rank
export const rankIcons: { [key: string]: React.ElementType } = {
    iniciante: Shield,
    modder_junior: Construction,
    modder_pleno: Star,
    modder_senior: BrainCircuit,
    especialista_samp: Gem,
    master_modder: Crown,
    admin: Crown,
};
