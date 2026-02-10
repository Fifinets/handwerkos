import React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface ScrollRevealWrapperProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    staggerChildren?: number;
    threshold?: number; // 0 to 1
}

const ScrollRevealWrapper: React.FC<ScrollRevealWrapperProps> = ({
    children,
    className = "",
    delay = 0,
    staggerChildren = 0.1,
    threshold = 0.2
}) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    // If reduced motion is preferred, render without animation
    if (prefersReducedMotion) {
        return <div className={className}>{children}</div>;
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1], // Custom easy-ease-out
                delay,
                staggerChildren,
            }
        }
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: threshold }}
            variants={containerVariants}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export default ScrollRevealWrapper;
