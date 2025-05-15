"use client"

import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion } from "framer-motion"
import { CheckCircle, Loader2, Mail, MessageSquare, Phone, User } from 'lucide-react'
import { api } from "~/utils/api"
import toast from "react-hot-toast"

export const TierSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    email: z.string().email({ message: "Invalid email address" }),
    message: z.string().min(5, { message: "Message must be at least 5 characters" }),
})

const Support = () => {
    const [isSubmitted, setIsSubmitted] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<z.infer<typeof TierSchema>>({
        resolver: zodResolver(TierSchema),
        defaultValues: {},
    })

    const sendMail = api.admin.user.sendEmail.useMutation({
        onSuccess: () => {
            reset()
            setIsSubmitted(true)
            toast.success("Message sent successfully")

            // Reset the success state after 5 seconds
            setTimeout(() => {
                setIsSubmitted(false)
            }, 5000)
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof TierSchema>> = (data) => {
        sendMail.mutate({
            message: data.message,
            name: data.name,
            userEmail: data.email,
        })
    }

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5 },
        },
    }

    const contactItems = [
        {
            title: "Technical Support",
            email: "support@action-tokens.com",
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="h-6 w-6"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6m-3 18c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z"
                    />
                </svg>
            ),
        },
        {
            title: "Sales Questions",
            email: "sales@action-tokens.com",
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="h-6 w-6"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                    />
                </svg>
            ),
        },
        {
            title: "Press",
            email: "press@action-tokens.com",
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="h-6 w-6"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                    />
                </svg>
            ),
        },
        {
            title: "Bug Report",
            email: "bugs@action-tokens.com",
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="h-6 w-6"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082"
                    />
                </svg>
            ),
        },
    ]

    return (
        <div className="mx-auto min-h-screen bg-gradient-to-b from-background to-card px-4 py-12 md:px-6">
            <motion.section
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="mb-32 max-w-7xl mx-auto"
            >
                <motion.div variants={itemVariants} className="flex justify-center">
                    <div className="text-center md:max-w-xl lg:max-w-3xl">
                        <h2 className="mb-12 text-4xl font-bold text-foreground">
                            Need <span className="text-primary">Support</span>?
                        </h2>
                        <p className="mb-8 text-muted-foreground max-w-2xl mx-auto">
                            We{"'re"} here to help! Fill out the form below and our team will get back to you as soon as possible.
                        </p>
                    </div>
                </motion.div>

                <div className="flex flex-wrap items-start gap-8 lg:gap-12">
                    <motion.form
                        variants={itemVariants}
                        onSubmit={handleSubmit(onSubmit)}
                        className="w-full shrink-0 grow-0 basis-auto rounded-xl bg-card p-6 shadow-lg lg:w-5/12"
                    >
                        {isSubmitted ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-8 text-center"
                            >
                                <div className="mb-6 rounded-full bg-primary/10 p-3">
                                    <CheckCircle className="h-12 w-12 text-primary" />
                                </div>
                                <h3 className="mb-2 text-2xl font-bold text-card-foreground">Thank You!</h3>
                                <p className="mb-6 text-muted-foreground">
                                    Your message has been sent successfully. We{"'ll"} get back to you soon.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsSubmitted(false)}
                                    className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                >
                                    Send Another Message
                                </button>
                            </motion.div>
                        ) : (
                            <>
                                <div className="mb-6 w-full">
                                    <label className="mb-2 block font-medium text-card-foreground" htmlFor="name">
                                        Name
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <input
                                            {...register("name")}
                                            type="text"
                                            className="w-full rounded-md border border-input bg-background pl-10 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            id="name"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
                                </div>

                                <div className="mb-6 w-full">
                                    <label className="mb-2 block font-medium text-card-foreground" htmlFor="email">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <Mail className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="email"
                                            {...register("email")}
                                            className="w-full rounded-md border border-input bg-background pl-10 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            id="email"
                                            placeholder="action-tokens@example.com"
                                        />
                                    </div>
                                    {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
                                </div>

                                <div className="mb-6 w-full">
                                    <label className="mb-2 block font-medium text-card-foreground" htmlFor="message">
                                        Message
                                    </label>
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 pointer-events-none">
                                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <textarea
                                            {...register("message")}
                                            className="w-full rounded-md border border-input bg-background pl-10 py-3 min-h-[120px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            id="message"
                                            placeholder="How can we help you?"
                                        ></textarea>
                                    </div>
                                    {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || sendMail.isLoading}
                                    className="inline-flex items-center justify-center w-full rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 transition-colors"
                                >
                                    {isSubmitting || sendMail.isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        "Send Message"
                                    )}
                                </button>
                            </>
                        )}
                    </motion.form>

                    <motion.div variants={containerVariants} className="w-full shrink-0 grow-0 basis-auto lg:w-6/12">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {contactItems.map((item, index) => (
                                <motion.div
                                    key={index}
                                    variants={itemVariants}
                                    whileHover={{ y: -5 }}
                                    className="rounded-xl bg-card p-6 shadow-md transition-all hover:shadow-lg"
                                >
                                    <div className="flex items-start">
                                        <div className="shrink-0">
                                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                {item.icon}
                                            </div>
                                        </div>
                                        <div className="ml-4 grow">
                                            <p className="mb-2 font-bold text-card-foreground">{item.title}</p>
                                            <a
                                                href={`mailto:${item.email}`}
                                                className="text-primary hover:text-primary/80 hover:underline transition-colors"
                                            >
                                                {item.email}
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div variants={itemVariants} className="mt-12 rounded-xl bg-accent p-6 shadow-md">
                            <h3 className="mb-4 text-xl font-bold text-accent-foreground">Our Support Hours</h3>
                            <p className="mb-4 text-muted-foreground">
                                Our support team is available to help you during the following hours:
                            </p>
                            <div className="space-y-2 text-muted-foreground">
                                <p className="flex justify-between">
                                    <span className="font-medium">Monday - Friday:</span>
                                    <span>9:00 AM - 6:00 PM EST</span>
                                </p>
                                <p className="flex justify-between">
                                    <span className="font-medium">Saturday:</span>
                                    <span>10:00 AM - 4:00 PM EST</span>
                                </p>
                                <p className="flex justify-between">
                                    <span className="font-medium">Sunday:</span>
                                    <span>Closed</span>
                                </p>
                            </div>
                            <div className="mt-6 flex items-center">
                                <Phone className="h-5 w-5 text-primary mr-2" />
                                <span className="font-medium text-accent-foreground">Emergency Support: </span>
                                <a href="tel:+1234567890" className="ml-2 text-primary hover:text-primary/80 hover:underline">
                                    +1 (234) 567-890
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </motion.section>
        </div>
    )
}

export default Support

