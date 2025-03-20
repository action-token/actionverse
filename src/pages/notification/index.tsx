"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Bell, Users } from "lucide-react"
import UserNotification from "~/components/notification/user-notification"
import CreatorNotifications from "~/components/notification/creator-notification"

const Notification = () => {
    const [activeTab, setActiveTab] = useState("user")

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container h-[calc(100vh-10vh)]  mx-auto max-w-5xl py-8">
            <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="mb-8 text-center"
            >
                <h1 className="text-3xl font-bold">Notifications</h1>
                <p className="mt-2 ">Stay updated with all your activities</p>
            </motion.div>

            <Tabs defaultValue="user" className="w-full" onValueChange={setActiveTab}>
                <div className="flex justify-center mb-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2 h-14 p-1 rounded-xl bg-primary shadow-sm shadow-foreground">
                        <TabsTrigger
                            value="user"
                            className="flex items-center justify-center gap-2 rounded-lg   data-[state=active]:shadow-sm data-[state=active]:shadow-foreground  h-12"
                        >
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: activeTab === "user" ? 1 : 0.8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Bell className={`h-5 w-5`} />
                            </motion.div>
                            <span>User Notifications</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="creator"
                            className="flex items-center justify-center gap-2 rounded-lg  data-[state=active]:shadow-sm data-[state=active]:shadow-foreground  h-12"
                        >
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: activeTab === "creator" ? 1 : 0.8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Users className={`h-5 w-5 `} />
                            </motion.div>
                            <span>Creator Notifications</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <TabsContent value="user" className="mt-0">
                            <UserNotification />
                        </TabsContent>
                        <TabsContent value="creator" className="mt-0">
                            <CreatorNotifications />
                        </TabsContent>
                    </motion.div>
                </AnimatePresence>
            </Tabs>
        </motion.div>
    )
}

export default Notification

