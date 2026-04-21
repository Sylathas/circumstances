"use client";

/**
 * LoadingScreen renders a full-screen black overlay with the Keyhole SVG centered.
 * It fades out via framer-motion once the LoadingContext reports isReady.
 * Only visible on initial home-page load; skipped on route navigations.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "@/app/context/LoadingContext";

export function LoadingScreen() {
  const { isReady } = useLoading();

  return (
    <AnimatePresence>
      {!isReady && (
        <motion.div
          key="loading-screen"
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
        >
          <motion.div
            animate={{ opacity: [0.1, 0.9, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src="/Keyhole.svg"
              alt=""
              width={20}
              height={20}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
