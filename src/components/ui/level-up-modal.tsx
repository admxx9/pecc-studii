
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ranks, rankIcons } from '@/config/ranks';
import { User, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from 'react-confetti';

interface LevelUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    oldRank: string;
    newRank: string;
    userAvatar: string | null;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose, oldRank, newRank, userAvatar }) => {
    const [progress, setProgress] = useState(0);
    const [animationStep, setAnimationStep] = useState<'initial' | 'progress' | 'reveal' | 'finished'>('initial');

    const oldRankName = ranks[oldRank] || 'Desconhecido';
    const newRankName = ranks[newRank] || 'Novo Nível';
    const OldIcon = rankIcons[oldRank] || Award;
    const NewIcon = rankIcons[newRank] || Award;

    // A simple mapping from rank to a numeric value for the progress bar
    const rankToValue = (rank: string) => {
        const rankOrder = Object.keys(ranks);
        const index = rankOrder.indexOf(rank);
        return index >= 0 ? ((index + 1) / rankOrder.length) * 100 : 0;
    }

    const startValue = rankToValue(oldRank);
    const endValue = rankToValue(newRank);
    
    useEffect(() => {
        if (isOpen) {
            setAnimationStep('initial');
            setProgress(startValue); // Start progress at the old rank's value
            
            // Start the animation sequence
            setTimeout(() => {
                setAnimationStep('progress');
                 setTimeout(() => {
                    setProgress(endValue);
                }, 100); // Small delay to ensure CSS transition triggers
            }, 500); // Initial delay before progress bar starts moving
        }
    }, [isOpen, startValue, endValue]);

     useEffect(() => {
        if (progress === endValue && animationStep === 'progress') {
            // Once progress bar is full, trigger reveal
            setTimeout(() => {
                setAnimationStep('reveal');
                // Trigger finished state for confetti
                 setTimeout(() => {
                    setAnimationStep('finished');
                 }, 1500); // Let confetti run for a bit
            }, 1000); // Wait for progress bar animation to finish (matches CSS transition)
        }
    }, [progress, endValue, animationStep]);


    const handleClose = () => {
        setAnimationStep('initial');
        setProgress(0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl overflow-hidden p-0">
                {animationStep === 'finished' && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={250} />}
                <div className="p-8 text-center relative z-10">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-3xl font-bold text-primary">Você Subiu de Nível!</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-lg">Parabéns pela sua promoção!</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex justify-around items-center mb-6">
                        {/* Old Rank */}
                        <div className="flex flex-col items-center gap-2 text-muted-foreground transition-all duration-500">
                             <OldIcon className="w-10 h-10" />
                            <span className="font-semibold text-sm">{oldRankName}</span>
                        </div>

                        {/* Avatar */}
                        <div className="relative">
                            <Avatar className={cn(
                                'h-28 w-28 border-4 transition-all duration-1000 ease-out',
                                animationStep === 'reveal' ? 'border-yellow-500 scale-110 shadow-lg' : 'border-border'
                            )}>
                                <AvatarImage src={userAvatar || undefined} />
                                <AvatarFallback>{'UU'}</AvatarFallback>
                            </Avatar>
                        </div>
                        
                        {/* New Rank - Revealed later */}
                         <div className={cn(
                            "flex flex-col items-center gap-2 text-primary transition-all duration-500",
                             animationStep === 'reveal' || animationStep === 'finished' ? 'opacity-100 scale-110' : 'opacity-0 scale-90'
                         )}>
                             <NewIcon className="w-10 h-10 text-yellow-500" />
                            <span className="font-bold text-sm text-yellow-500">{newRankName}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-secondary rounded-full h-4 mb-8 border border-border">
                         <div
                            style={{ width: `${progress}%` }}
                            className="bg-primary h-full rounded-full transition-all duration-1000 ease-in-out"
                         ></div>
                    </div>

                    <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Continuar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LevelUpModal;
