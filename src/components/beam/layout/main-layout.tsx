"use client"

import type React from "react"
import { useState } from "react"
import Sidebar from "~/components/beam/nav/sidebar"
import { Header } from "~/components/beam/nav/header"
import { cn } from "~/lib/utils"

export function MainLayout({ children }: { children: React.ReactNode }) {


  return (
    <div className="bg-background flex flex-col relative h-[calc(100vh-10vh)] overflow-hidden">

      <Sidebar />

      <div className="container mx-auto p-6 lg:p-8 animate-fade-in overflow-y-auto">{children}</div>

    </div>
  )
}
