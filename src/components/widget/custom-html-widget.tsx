"use client"

import { useState } from "react"
import { Edit, Save } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Textarea } from "~/components/shadcn/ui/textarea"

interface CustomHTMLWidgetProps {
    editMode?: boolean
}

export default function CustomHTMLWidget({ editMode }: CustomHTMLWidgetProps) {
    const [html, setHtml] = useState(`<div style="padding: 1rem; height: 100%;">
  <h2 style="margin-bottom: 0.5rem; font-weight: bold;">Welcome to your custom widget!</h2>
  <p>You can add any HTML content here:</p>
  <ul style="margin-top: 0.5rem; padding-left: 1.5rem; list-style-type: disc;">
    <li>Add embedded media</li>
    <li>Create custom layouts</li>
    <li>Insert third-party widgets</li>
  </ul>
</div>`)
    const [isEditing, setIsEditing] = useState(false)
    const [activeTab, setActiveTab] = useState("preview")

    return (
        <div className="h-full flex flex-col">
            {isEditing ? (
                <>
                    <div className="flex items-center justify-between p-2 border-b">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="edit">Edit</TabsTrigger>
                                <TabsTrigger value="preview">Preview</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button size="sm" variant="ghost" className="ml-2" onClick={() => setIsEditing(false)}>
                            <Save className="h-4 w-4" />
                        </Button>
                    </div>

                    <TabsContent value="edit" className="flex-1 p-0 m-0">
                        <Textarea
                            value={html}
                            onChange={(e) => setHtml(e.target.value)}
                            className="font-mono text-xs h-full resize-none"
                        />
                    </TabsContent>

                    <TabsContent value="preview" className="flex-1 p-0 m-0 overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: html }} className="h-full" />
                    </TabsContent>
                </>
            ) : (
                <>
                    <div dangerouslySetInnerHTML={{ __html: html }} className="h-full overflow-auto" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-30 hover:opacity-100"
                        onClick={() => setIsEditing(true)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </>
            )}
        </div>
    )
}
