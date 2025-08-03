import { redirect } from "next/navigation"
import { useRouter } from "next/router"

export default function AugmentedRealityPage() {
    const router = useRouter()
    router.push(`/augmented-reality/home`)
}

