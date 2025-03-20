"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Camera, Loader2, Save } from "lucide-react"
import type React from "react" // Added import for React
import { api } from "~/utils/api"
import { z } from "zod"
import { SubmitHandler, useForm } from "react-hook-form";
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
} from "~/components/shadcn/ui/form";
import { Label } from "~/components/shadcn/ui/label"
import { UploadS3Button } from "~/components/common/upload-button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { toast } from "~/components/shadcn/ui/use-toast"

export const AboutUserShema = z.object({
    bio: z
        .string()
        .max(100, { message: "Bio must be less than 101 characters" })
        .nullable(),
    name: z
        .string()
        .min(3, { message: "Name must be greater than 2 characters." })
        .max(100, { message: "Name must be less than 99 characters." }),
    profileUrl: z.string().nullable().optional(),
});

type UserSettingsType = {
    name: string | null;
    id: string;
    joinedAt: Date | null;
    bio: string | null;
    email: string | null;
    image: string | null;
    emailVerified: Date | null;
    fromAppSignup: boolean | null;
}

export default function AboutUserData() {
    const user = api.fan.user.getUser.useQuery();

    if (!user.data && !user.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" >
                <div>User data not found!</div>
            </div>
        )
    }
    if (user.isLoading) {
        return (
            <div className="h-[calc(100vh-10.8vh)]">
                {/* Cover Image Skeleton */}
                <div className="relative h-[240px] w-full">
                    <Skeleton className="h-full w-full" />
                    <Skeleton className="absolute right-4 top-4 h-10 w-10 rounded-full" />
                </div>

                <div className="relative px-4">
                    {/* Profile Info Section */}
                    <div className="relative">
                        {/* Profile Picture Skeleton */}
                        <div className="absolute -top-32 left-0">
                            <Skeleton className="h-64 w-64 rounded-full" />
                        </div>

                        {/* Profile Details Skeleton */}
                        <div className="lg:grid grid-cols-12 p-6 flex flex-col">
                            <div className="pt-28 col-span-4">
                                <Skeleton className="h-8 w-48 mb-4" />
                                <Skeleton className="h-4 w-64 mb-2" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                            <div>
                                <Skeleton className="w-full lg:w-[calc(100vw-50vw)] h-56" />
                            </div>
                        </div>
                    </div>

                    {/* Edit Form Skeleton */}
                    <div className="flex gap-8 p-6">
                        {/* Profile Image Preview Skeleton */}
                        <div className="flex-shrink-0 hidden lg:block">
                            <Skeleton className="h-[300px] w-[300px] rounded-full" />
                        </div>

                        {/* Edit Form Skeleton */}
                        <Card className="flex-1 bg-[#fdfbf7] p-6">
                            <div className="space-y-4">
                                <Skeleton className="h-4 w-20 mb-2" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-4 w-48 mt-1" />

                                <Skeleton className="h-4 w-20 mb-2" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-4 w-48 mt-1" />

                                <Skeleton className="h-10 w-full mt-8" />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }
    if (user.error) {
        return <div>Error: {user.error.message}</div>
    }

    if (user.data) {
        return <AboutUser
            user={user.data}
        />
    }




}


const AboutUser = ({ user }: { user: UserSettingsType }) => {
    const utils = api.useUtils();

    const mutation = api.fan.user.updateUserProfile.useMutation({
        onSuccess: async () => {
            toast({
                title: "Profile Updated",
                description: "Your profile information has been updated successfully.",
                variant: "default",
            });
            await utils.fan.user.getUser.invalidate();

        },
        onError: (error) => {
            toast({
                title: "Profile Update Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });


    const updateProfileMutation =
        api.fan.user.changeUserProfilePicture.useMutation();

    const form = useForm({
        resolver: zodResolver(AboutUserShema),
        defaultValues: {
            name: user.name ?? "",
            bio: user.bio ?? "",
        },
    });

    const onSubmit: SubmitHandler<z.infer<typeof AboutUserShema>> = (data) =>
        mutation.mutate(data, {

        });

    return (
        <div className="h-[calc(100vh-10.8vh)] bg-background">
            {/* Cover Image */}
            <div className="relative h-[240px] w-full bg-[#1a1a1a] rounded-t-lg">
                {/* <Image src={user.image || "/images/logo.png"} alt="Cover" fill className="object-cover rounded-t-lg" priority /> */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-lg shadow-md" />
                {/* <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-4 top-4 bg-white/80 hover:bg-white"

                >
                    <Camera className="h-4 w-4" />
                </Button> */}
            </div>

            <div className="relative  px-4">
                {/* Profile Info Section */}
                <div className="relative">
                    {/* Profile Picture */}
                    <div className="absolute -top-32 left-0">
                        <div className="relative">
                            <Image
                                src={user.image ?? "/images/logo.png"}
                                alt="Profile picture"
                                width={250}
                                height={250}
                                className="rounded-full h-64 w-64 border-2 "
                            />
                            <UploadS3Button
                                className="absolute top-16 right-0 bg-white h-8 w-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center lg:hidden"
                                endpoint="imageUploader"
                                varient="input"
                                onClientUploadComplete={(res) => {
                                    const fileUrl = res.url;
                                    updateProfileMutation.mutate(fileUrl);
                                }}
                                onUploadError={(error: Error) => {
                                    // Do something with the error.
                                    toast({
                                        title: "Upload Error",
                                        description: error.message,
                                        variant: "destructive",

                                    })
                                }}
                            />
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="lg:grid grid-cols-12 p-6 flex flex-col">
                        <div className="pt-28 col-span-4">
                            <h1 className="text-2xl font-bold ">{user.name && user?.name?.length > 21 ? user.name?.slice(0, 22) + "..." : user.name?.slice(0, 22)}</h1>

                            <div className="mt-2 space-y-1 text-md  ">
                                <span className=" font-bold"> PUB KEY:</span>
                                <span className="text-muted-foreground bg-primary"> {addrShort(user.id, 7)}</span>
                                <span className="mr-1">  <CopyToClip text={user.id} collapse={7} /></span>

                            </div>
                            <div className="mt-1 space-y-1 text-md  ">
                                <span className="mr-1 font-bold"> JOINED AT:</span>
                                <span className="text-muted-foreground"> {
                                    new Date(user.joinedAt
                                        ? user.joinedAt
                                        : new Date()

                                    ).toLocaleDateString()
                                }</span>

                            </div>
                        </div>
                        <div>
                            <Textarea className="w-full  lg:w-[calc(100vw-50vw)] h-56 border-[2px] bg-gray-100  " disabled



                            >
                                {user.bio?.length ? user.bio : "You haven't set your bio yet."}
                            </Textarea>
                        </div>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="flex gap-8 p-6 shadow-md border-[1px]">
                    {/* Profile Image Preview */}
                    <div className=" items-center hidden lg:flex">
                        <div className="relative  overflow-hidden rounded-full  bg-white p-0">
                            <div className="relative">
                                <Image
                                    src={user.image ?? "/images/logo.png"}
                                    alt="Profile picture"
                                    width={250}
                                    height={250}
                                    className="rounded-full h-64 w-64 border-2 "
                                />
                                <UploadS3Button
                                    className="absolute top-16 right-0 bg-white h-8 w-8 rounded-full bg-white/80 hover:bg-white"
                                    endpoint="imageUploader"
                                    varient="input"
                                    onClientUploadComplete={(res) => {
                                        const fileUrl = res.url;
                                        updateProfileMutation.mutate(fileUrl);
                                    }}
                                    onUploadError={(error: Error) => {
                                        // Do something with the error.
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

                    {/* Edit Form */}
                    <Card className="flex-1  p-6">

                        <div className="space-y-4">
                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-8"
                                >
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold uppercase">
                                                    Name
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        disabled={mutation.isLoading}
                                                        className="focus-visible:ring-0 focus-visible:ring-offset-0"
                                                        placeholder="Name..."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs ">
                                                    Name must be between 3 to 99 characters
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
                                                <FormLabel className="text-xs font-bold uppercase">
                                                    BIO
                                                </FormLabel>

                                                <FormControl>
                                                    <Textarea
                                                        disabled={mutation.isLoading}
                                                        className="min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0"
                                                        placeholder="Bio..."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    Bio must be less than 101 characters
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex items-center justify-center space-x-4 ">
                                        <Button
                                            type="submit"
                                            disabled={mutation.isLoading}
                                            variant="default"
                                            className="w-full shrink-0 font-bold shadow-sm  shadow-black"
                                        >
                                            {mutation.isLoading ? (
                                                <Loader2
                                                    className="mr-2 h-4 w-4 animate-spin"
                                                    size={20}
                                                />
                                            ) : (
                                                <Save className="mr-2  font-bold" size={20} />
                                            )}
                                            {mutation.isLoading ? "Saving..." : "Save"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </div>

                    </Card>
                </div>
            </div>
        </div>
    )
}
