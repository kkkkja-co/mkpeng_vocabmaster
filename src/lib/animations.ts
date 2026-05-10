export const springSnappy = { type: "spring" as const, stiffness: 400, damping: 30 };
export const springSmooth = { type: "spring" as const, stiffness: 260, damping: 28 };
export const springBouncy = { type: "spring" as const, stiffness: 320, damping: 20 };

export const durationFast = 0.18;
export const durationNormal = 0.28;
export const durationSlow = 0.38;

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: durationNormal, ease: "easeOut" as const },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: durationNormal },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: springSnappy,
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: durationNormal, ease: "easeOut" as const },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: springSmooth,
};
