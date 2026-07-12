import { useEffect } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "framer-motion";

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  glowOnChange?: boolean;
};

export function AnimatedNumber({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
}: Props) {
  const mValue = useMotionValue(value);
  const spring = useSpring(mValue, {
    stiffness: 120,
    damping: 20,
    mass: 0.8,
  });

  useEffect(() => {
    mValue.set(value);
  }, [value, mValue]);

  const display = useTransform(spring, (v) => {
    const num = typeof v === "number" ? v : Number(v) || 0;
    return `${prefix}${num.toFixed(decimals)}${suffix}`;
  });

  return <motion.span className={className}>{display}</motion.span>;
}
