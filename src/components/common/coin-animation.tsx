"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export default function CoinAnimation() {
    const coinVariants = {
        flip: {
            rotateY: [0, 360],
            transition: {
                duration: 1,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.5,
            },
        },
    }

    return (
        <motion.div className="perspective-1000" variants={coinVariants} animate="flip">
            <Image
                className="h-20 w-28 rounded-full shadow-lg"
                height={200}
                width={200}
                src="/images/logo.png"
                alt="actionverse"
            />
        </motion.div>
    )
}

