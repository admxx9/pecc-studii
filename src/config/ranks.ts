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

// Avatars organized by rank
export const avatarsByRank: { [key: string]: { id: string; url: string }[] } = {
  iniciante: [
    { id: 'iniciante1', url: 'https://i.imgur.com/D496jwP.png' }, // fundo vermelho
    { id: 'iniciante2', url: 'https://i.imgur.com/WMK9rJs.png' }, // fundo azul
    { id: 'iniciante3', url: 'https://i.imgur.com/BwGqgFs.png' }, // fundo roxo
    { id: 'iniciante4', url: 'https://i.imgur.com/IrMkLO8.png' }, // fundo cinza
    { id: 'iniciante5', url: 'https://i.imgur.com/OFi0aNr.png' }, // fundo laranja
  ],
  modder_junior: [
    { id: 'modder_junior1', url: 'https://i.imgur.com/YHKlctd.png' }, // vermelho
    { id: 'modder_junior3', url: 'https://i.imgur.com/JzCZVwr.png' }, // azul
    { id: 'modder_junior2', url: 'https://i.imgur.com/zzC6acG.png' }, // roxo
    { id: 'modder_junior4', url: 'https://i.imgur.com/QEfDDEw.png' }, // cinza
    { id: 'modder_junior5', url: 'https://i.imgur.com/1SR35DZ.png' }, // laranja
  ],
  // Add other ranks as needed
};
