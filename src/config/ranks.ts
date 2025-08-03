// src/config/ranks.ts

// Define ranks and their display names/descriptions
export const ranks: { [key: string]: string } = {
  iniciante: 'Iniciante',
  modder_junior: 'Modder Júnior',
  modder_pleno: 'Modder Pleno',
  modder_senior: 'Modder Sênior',
  especialista_samp: 'Especialista em SAMP',
  master_modder: 'Master Modder',
};

// Define rank keys for Zod enum
export const rankKeys = Object.keys(ranks) as [string, ...string[]];
