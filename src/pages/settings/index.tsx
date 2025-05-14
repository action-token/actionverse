"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Camera, Calendar, Loader2, Save, UserIcon } from "lucide-react"
import { api } from "~/utils/api"
import { z } from "zod"
import { type SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { addrShort } from "~/utils/utils"
import CopyToClip from "~/components/common/copy_to_Clip"
import {
    Form,
    FormField,
    FormItem,
    FormControl,
    FormLabel,
    FormMessage,
    FormDescription,
} from "~/components/shadcn/ui/form"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { toast } from "~/components/shadcn/ui/use-toast"
import { motion } from "framer-motion"
import { Separator } from "~/components/shadcn/ui/separator"
import { Badge } from "~/components/shadcn/ui/badge"
import { UploadS3Button } from "~/components/common/upload-button"

export const AboutUserShema = z.object({
    bio: z.string().max(100, { message: "Bio must be less than 101 characters" }).nullable(),
    name: z
        .string()
        .min(3, { message: "Name must be greater than 2 characters." })
        .max(100, { message: "Name must be less than 99 characters." }),
    profileUrl: z.string().nullable().optional(),
})

type UserSettingsType = {
    name: string | null
    id: string
    joinedAt: Date | null
    bio: string | null
    email: string | null
    image: string | null
    emailVerified: Date | null
    fromAppSignup: boolean | null
}

export default function AboutUserData() {
    const user = api.fan.user.getUser.useQuery()

    if (!user.data && !user.isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Card className="w-full max-w-md p-6 text-center">
                    <div className="mb-4 flex justify-center">
                        <UserIcon className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold">User Not Found</h2>
                    <p className="text-muted-foreground">User data could not be retrieved. Please try again later.</p>
                </Card>
            </div>
        )
    }

    if (user.isLoading) {
        return <ProfileSkeleton />
    }

    if (user.error) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Card className="w-full max-w-md p-6 text-center">
                    <div className="mb-4 flex justify-center text-destructive">
                        <UserIcon className="h-16 w-16" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold">Error</h2>
                    <p className="text-muted-foreground">{user.error.message}</p>
                </Card>
            </div>
        )
    }

    if (user.data) {
        return <AboutUser user={user.data} />
    }
}

const ProfileSkeleton = () => {
    return (
        <div className="min-h-screen bg-background">
            {/* Cover Image Skeleton */}
            <div className="relative h-[240px] w-full">
                <Skeleton className="h-full w-full rounded-b-none rounded-t-xl" />
            </div>

            <div className="mx-auto max-w-6xl px-4">
                {/* Profile Info Section */}
                <div className="relative">
                    {/* Profile Picture Skeleton */}
                    <div className="absolute -top-24 left-4 md:left-8">
                        <Skeleton className="h-48 w-48 rounded-full border-4 border-background" />
                    </div>

                    {/* Profile Details Skeleton */}
                    <div className="pt-28 md:grid md:grid-cols-12 md:gap-8">
                        <div className="md:col-span-4 space-y-4">
                            <Skeleton className="h-8 w-48" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-64" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                        </div>
                        <div className="md:col-span-8 mt-6 md:mt-0">
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                    </div>
                </div>

                {/* Edit Form Skeleton */}
                <Card className="mt-8 border shadow-md">
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Profile Image Preview Skeleton */}
                            <div className="hidden md:block">
                                <Skeleton className="h-64 w-64 rounded-full" />
                            </div>

                            {/* Edit Form Skeleton */}
                            <div className="flex-1 space-y-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-4 w-48" />
                                </div>

                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-4 w-48" />
                                </div>

                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

const AboutUser = ({ user }: { user: UserSettingsType }) => {
    const utils = api.useUtils()
    const [isHovered, setIsHovered] = useState(false)

    const mutation = api.fan.user.updateUserProfile.useMutation({
        onSuccess: async () => {
            toast({
                title: "Profile Updated",
                description: "Your profile information has been updated successfully.",
                variant: "default",
            })
            await utils.fan.user.getUser.invalidate()
        },
        onError: (error) => {
            toast({
                title: "Profile Update Failed",
                description: error.message,
                variant: "destructive",
            })
        },
    })

    const updateProfileMutation = api.fan.user.changeUserProfilePicture.useMutation({
        onSuccess: async () => {
            toast({
                title: "Profile Picture Updated",
                description: "Your profile picture has been updated successfully.",
            })
            await utils.fan.user.getUser.invalidate()
        },
    })

    const form = useForm({
        resolver: zodResolver(AboutUserShema),
        defaultValues: {
            name: user.name ?? "",
            bio: user.bio ?? "",
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof AboutUserShema>> = (data) => mutation.mutate(data)

    return (
        <div className="min-h-screen bg-background pb-16">
            {/* Cover Image */}
            <div className="relative h-[240px] w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/30 rounded-b-3xl shadow-md" />
                <div className="absolute inset-0 bg-[url('/abstract-gradient-pattern.png')] bg-cover bg-center opacity-30 mix-blend-overlay" />
            </div>

            <div className="mx-auto max-w-6xl px-4">
                {/* Profile Info Section */}
                <div className="relative">
                    {/* Profile Picture */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="absolute -top-24 left-4 md:left-8"
                    >
                        <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                            <div className="relative h-48 w-48 overflow-hidden rounded-full border-4 border-background shadow-lg">
                                <Image
                                    src={user.image ?? "/images/action/logo.png"}
                                    alt="Profile picture"
                                    fill
                                    className="object-cover"
                                />
                                <div
                                    className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"
                                        }`}
                                >
                                    <UploadS3Button
                                        className="rounded-full bg-background/80 p-2 hover:bg-background"
                                        endpoint="imageUploader"
                                        variant="input"
                                        onClientUploadComplete={(res) => {
                                            updateProfileMutation.mutate(res.url)
                                        }}
                                        onUploadError={(error: Error) => {
                                            toast({
                                                title: "Upload Error",
                                                description: error.message,
                                                variant: "destructive",
                                            })
                                        }}
                                    />

                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Profile Details */}
                    <div className="pt-28 md:grid md:grid-cols-12 md:gap-8">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="md:col-span-4 space-y-4"
                        >
                            <h1 className="text-3xl font-bold">
                                {user.name && user?.name?.length > 21
                                    ? user.name?.slice(0, 22) + "..."
                                    : user.name?.slice(0, 22) || "Anonymous User"}
                            </h1>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="px-3 py-1 font-mono">
                                        {addrShort(user.id, 7)}
                                    </Badge>
                                    <CopyToClip text={user.id} collapse={7} />
                                </div>

                                <div className="flex items-center text-muted-foreground">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    <span>
                                        Joined{" "}
                                        {new Date(user.joinedAt ? user.joinedAt : new Date()).toLocaleDateString(undefined, {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="md:col-span-8 mt-6 md:mt-0"
                        >
                            <Card className="overflow-hidden border shadow">
                                <CardHeader className="bg-muted/50 py-3">
                                    <CardTitle className="text-sm font-medium uppercase">About Me</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <p className="min-h-[100px] whitespace-pre-wrap text-muted-foreground">
                                        {user.bio?.length ? user.bio : "No bio information provided yet."}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>

                {/* Edit Profile Section */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <Card className="mt-12 border shadow-md">
                        <CardHeader>
                            <CardTitle>Edit Profile</CardTitle>
                            <Separator />
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-8">
                                {/* Profile Image Preview (Desktop only) */}
                                <div className="hidden md:block">
                                    <div className="relative h-64 w-64 overflow-hidden rounded-full border shadow-sm">
                                        <Image
                                            src={user.image ?? "/images/action/logo.png"}
                                            alt="Profile picture"
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 hover:opacity-100">
                                            <UploadS3Button
                                                className="rounded-full bg-background/80 p-2 hover:bg-background"
                                                endpoint="imageUploader"
                                                variant="input"
                                                onClientUploadComplete={(res) => {
                                                    updateProfileMutation.mutate(res.url)
                                                }}
                                                onUploadError={(error: Error) => {
                                                    toast({
                                                        title: "Upload Error",
                                                        description: error.message,
                                                        variant: "destructive",
                                                    })
                                                }}

                                            />
                                        </div>
                                    </div>
                                    <p className="mt-2 text-center text-sm text-muted-foreground">Hover to change photo</p>
                                </div>

                                {/* Edit Form */}
                                <div className="flex-1">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-sm font-semibold">Display Name</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                disabled={mutation.isLoading}
                                                                className="focus-visible:ring-1 focus-visible:ring-primary"
                                                                placeholder="Enter your name"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs text-muted-foreground">
                                                            This is the name that will be displayed to other users
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="bio"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-sm font-semibold">Bio</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                disabled={mutation.isLoading}
                                                                className="min-h-[120px] focus-visible:ring-1 focus-visible:ring-primary resize-none"
                                                                placeholder="Tell others a bit about yourself..."
                                                                {...field}
                                                                value={field.value || ""}
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span>A brief description about yourself</span>
                                                            <span>{field.value?.length || 0}/100</span>
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    type="submit"
                                                    disabled={mutation.isLoading || !form.formState.isDirty}
                                                    variant="default"
                                                    className="px-8"
                                                >
                                                    {mutation.isLoading ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Saving...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="mr-2 h-4 w-4" />
                                                            Save Changes
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    </Form>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
