// "use client"

// import { useState } from "react"
// import { Check, Palette, Settings } from 'lucide-react'

// import { Button } from "~/components/shadcn/ui/button"
// import {
//     DropdownMenu,
//     DropdownMenuContent,
//     DropdownMenuGroup,
//     DropdownMenuItem,
//     DropdownMenuLabel,
//     DropdownMenuSeparator,
//     DropdownMenuTrigger,
// } from "~/components/shadcn/ui/dropdown-menu"
// import {
//     Dialog,
//     DialogContent,
//     DialogDescription,
//     DialogFooter,
//     DialogHeader,
//     DialogTitle,
// } from "~/components/shadcn/ui/dialog"
// import { Input } from "~/components/shadcn/ui/input"
// import { Label } from "~/components/shadcn/ui/label"
// import { Slider } from "~/components/shadcn/ui/slider"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
// import { RadioGroup, RadioGroupItem } from "~/components/shadcn/ui/radio-group"

// import type { Theme } from "~/types/organization/dashboard"

// // Define some preset themes
// export const STYLE_PRESETS: Theme[] = [
//     {
//         name: "Default Light",
//         colors: {
//             primary: "#0070f3",
//             secondary: "#7928ca",
//             accent: "#f5a623",
//             background: "#ffffff",
//             card: "#ffffff",
//             text: "#000000",
//             muted: "#f1f5f9",
//             border: "#e2e8f0",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Inter, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 8,
//             borderWidth: 1,
//             shadowSize: "md",
//             contentDensity: "normal",
//         },
//     },
//     {
//         name: "Dark Mode",
//         colors: {
//             primary: "#3b82f6",
//             secondary: "#8b5cf6",
//             accent: "#f59e0b",
//             background: "#121212",
//             card: "#1e1e1e",
//             text: "#ffffff",
//             muted: "#2a2a2a",
//             border: "#333333",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Inter, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 8,
//             borderWidth: 1,
//             shadowSize: "lg",
//             contentDensity: "normal",
//         },
//     },
//     {
//         name: "Vibrant",
//         colors: {
//             primary: "#ff0080",
//             secondary: "#7928ca",
//             accent: "#00ffff",
//             background: "#f8fafc",
//             card: "#ffffff",
//             text: "#0f172a",
//             muted: "#e2e8f0",
//             border: "#cbd5e1",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Poppins, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 16,
//             borderWidth: 2,
//             shadowSize: "lg",
//             contentDensity: "spacious",
//         },
//     },
//     {
//         name: "Minimal",
//         colors: {
//             primary: "#000000",
//             secondary: "#666666",
//             accent: "#0070f3",
//             background: "#ffffff",
//             card: "#ffffff",
//             text: "#000000",
//             muted: "#f1f5f9",
//             border: "#e2e8f0",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Inter, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 0,
//             borderWidth: 1,
//             shadowSize: "none",
//             contentDensity: "compact",
//         },
//     },
//     {
//         name: "Nature",
//         colors: {
//             primary: "#2e7d32",
//             secondary: "#1b5e20",
//             accent: "#ffc107",
//             background: "#f1f8e9",
//             card: "#ffffff",
//             text: "#1b5e20",
//             muted: "#dcedc8",
//             border: "#c5e1a5",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Montserrat, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 12,
//             borderWidth: 1,
//             shadowSize: "sm",
//             contentDensity: "normal",
//         },
//     },
//     {
//         name: "Ocean",
//         colors: {
//             primary: "#0277bd",
//             secondary: "#01579b",
//             accent: "#00b0ff",
//             background: "#e1f5fe",
//             card: "#ffffff",
//             text: "#01579b",
//             muted: "#b3e5fc",
//             border: "#81d4fa",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Raleway, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 10,
//             borderWidth: 1,
//             shadowSize: "md",
//             contentDensity: "normal",
//         },
//     },
//     {
//         name: "Sunset",
//         colors: {
//             primary: "#ff5722",
//             secondary: "#e64a19",
//             accent: "#ffc107",
//             background: "#fff3e0",
//             card: "#ffffff",
//             text: "#bf360c",
//             muted: "#ffe0b2",
//             border: "#ffcc80",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Playfair Display, serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 8,
//             borderWidth: 1,
//             shadowSize: "md",
//             contentDensity: "spacious",
//         },
//     },
//     {
//         name: "Neon",
//         colors: {
//             primary: "#00ff00",
//             secondary: "#ff00ff",
//             accent: "#00ffff",
//             background: "#0a0a0a",
//             card: "#1a1a1a",
//             text: "#ffffff",
//             muted: "#2a2a2a",
//             border: "#00ff00",
//         },
//         font: {
//             family: "Inter, sans-serif",
//             heading: "Orbitron, sans-serif",
//             body: "Inter, sans-serif",
//         },
//         style: {
//             borderRadius: 0,
//             borderWidth: 2,
//             shadowSize: "lg",
//             contentDensity: "compact",
//         },
//     },
// ];

// interface ThemeCustomizerProps {
//     theme: Theme
//     onThemeChange: (theme: Theme) => void
// }

// export default function ThemeCustomizer({ theme, onThemeChange }: ThemeCustomizerProps) {
//     const [isDialogOpen, setIsDialogOpen] = useState(false)
//     const [currentTheme, setCurrentTheme] = useState<Theme>(theme)

//     const handleThemeChange = (newTheme: Theme) => {
//         setCurrentTheme(newTheme)
//     }

//     const handleSaveTheme = () => {
//         onThemeChange(currentTheme)
//         setIsDialogOpen(false)
//     }

//     const handlePresetSelect = (preset: Theme) => {
//         setCurrentTheme(preset)
//         onThemeChange(preset)
//     }

//     return (
//         <>
//             <DropdownMenu>
//                 <DropdownMenuTrigger asChild>
//                     <Button variant="outline" size="sm">
//                         <Palette className="h-4 w-4 mr-2" />
//                         Theme
//                     </Button>
//                 </DropdownMenuTrigger>
//                 <DropdownMenuContent className="w-56">
//                     <DropdownMenuLabel>Theme Presets</DropdownMenuLabel>
//                     <DropdownMenuSeparator />
//                     <DropdownMenuGroup>
//                         {STYLE_PRESETS.map((preset) => (
//                             <DropdownMenuItem
//                                 key={preset.name}
//                                 onClick={() => handlePresetSelect(preset)}
//                                 className="flex items-center justify-between"
//                             >
//                                 <div className="flex items-center">
//                                     <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: preset.colors.primary }}></div>
//                                     <span>{preset.name}</span>
//                                 </div>
//                                 {theme.name === preset.name && <Check className="h-4 w-4" />}
//                             </DropdownMenuItem>
//                         ))}
//                     </DropdownMenuGroup>
//                     <DropdownMenuSeparator />
//                     <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
//                         <Settings className="h-4 w-4 mr-2" />
//                         <span>Customize Theme</span>
//                     </DropdownMenuItem>
//                 </DropdownMenuContent>
//             </DropdownMenu>

//             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//                 <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
//                     <DialogHeader>
//                         <DialogTitle>Customize Theme</DialogTitle>
//                         <DialogDescription>
//                             Customize the appearance of your dashboard. Changes will be applied when you save.
//                         </DialogDescription>
//                     </DialogHeader>

//                     <Tabs defaultValue="colors">
//                         <TabsList className="grid grid-cols-3 mb-4">
//                             <TabsTrigger value="colors">Colors</TabsTrigger>
//                             <TabsTrigger value="typography">Typography</TabsTrigger>
//                             <TabsTrigger value="layout">Layout</TabsTrigger>
//                         </TabsList>

//                         <TabsContent value="colors" className="space-y-4">
//                             <div className="grid grid-cols-2 gap-4">
//                                 <div className="space-y-2">
//                                     <Label htmlFor="primary-color">Primary Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.primary }}
//                                         ></div>
//                                         <Input
//                                             id="primary-color"
//                                             type="text"
//                                             value={currentTheme.colors.primary}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, primary: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="secondary-color">Secondary Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.secondary }}
//                                         ></div>
//                                         <Input
//                                             id="secondary-color"
//                                             type="text"
//                                             value={currentTheme.colors.secondary}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, secondary: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="accent-color">Accent Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.accent }}
//                                         ></div>
//                                         <Input
//                                             id="accent-color"
//                                             type="text"
//                                             value={currentTheme.colors.accent}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, accent: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="background-color">Background Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.background }}
//                                         ></div>
//                                         <Input
//                                             id="background-color"
//                                             type="text"
//                                             value={currentTheme.colors.background}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, background: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="card-color">Card Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.card }}
//                                         ></div>
//                                         <Input
//                                             id="card-color"
//                                             type="text"
//                                             value={currentTheme.colors.card}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, card: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="text-color">Text Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.text }}
//                                         ></div>
//                                         <Input
//                                             id="text-color"
//                                             type="text"
//                                             value={currentTheme.colors.text}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, text: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="muted-color">Muted Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.muted }}
//                                         ></div>
//                                         <Input
//                                             id="muted-color"
//                                             type="text"
//                                             value={currentTheme.colors.muted}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, muted: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="border-color">Border Color</Label>
//                                     <div className="flex">
//                                         <div
//                                             className="w-8 h-8 rounded-l-md border border-r-0"
//                                             style={{ backgroundColor: currentTheme.colors.border }}
//                                         ></div>
//                                         <Input
//                                             id="border-color"
//                                             type="text"
//                                             value={currentTheme.colors.border}
//                                             onChange={(e) =>
//                                                 handleThemeChange({
//                                                     ...currentTheme,
//                                                     colors: { ...currentTheme.colors, border: e.target.value },
//                                                 })
//                                             }
//                                             className="rounded-l-none"
//                                         />
//                                     </div>
//                                 </div>
//                             </div>
//                         </TabsContent>

//                         <TabsContent value="typography" className="space-y-4">
//                             <div className="space-y-4">
//                                 <div className="space-y-2">
//                                     <Label htmlFor="font-family">Font Family</Label>
//                                     <Input
//                                         id="font-family"
//                                         type="text"
//                                         value={currentTheme.font.family}
//                                         onChange={(e) =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 font: { ...currentTheme.font, family: e.target.value },
//                                             })
//                                         }
//                                     />
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="heading-font">Heading Font</Label>
//                                     <Input
//                                         id="heading-font"
//                                         type="text"
//                                         value={currentTheme.font.heading}
//                                         onChange={(e) =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 font: { ...currentTheme.font, heading: e.target.value },
//                                             })
//                                         }
//                                     />
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="body-font">Body Font</Label>
//                                     <Input
//                                         id="body-font"
//                                         type="text"
//                                         value={currentTheme.font.body}
//                                         onChange={(e) =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 font: { ...currentTheme.font, body: e.target.value },
//                                             })
//                                         }
//                                     />
//                                 </div>
//                             </div>
//                         </TabsContent>

//                         <TabsContent value="layout" className="space-y-4">
//                             <div className="space-y-4">
//                                 <div className="space-y-2">
//                                     <Label htmlFor="border-radius">Border Radius: {currentTheme.style.borderRadius}px</Label>
//                                     <Slider
//                                         id="border-radius"
//                                         min={0}
//                                         max={24}
//                                         step={1}
//                                         value={[currentTheme.style.borderRadius]}
//                                         onValueChange={(value) =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 style: { ...currentTheme.style, borderRadius: value[0] },
//                                             })
//                                         }
//                                     />
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label htmlFor="border-width">Border Width: {currentTheme.style.borderWidth}px</Label>
//                                     <Slider
//                                         id="border-width"
//                                         min={0}
//                                         max={4}
//                                         step={1}
//                                         value={[currentTheme.style.borderWidth]}
//                                         onValueChange={(value) =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 style: { ...currentTheme.style, borderWidth: value[0] },
//                                             })
//                                         }
//                                     />
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label>Shadow Size</Label>
//                                     <RadioGroup
//                                         value={currentTheme.style.shadowSize}
//                                         onValueChange={(value: "none" | "sm" | "md" | "lg") =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 style: { ...currentTheme.style, shadowSize: value },
//                                             })
//                                         }
//                                         className="flex space-x-2"
//                                     >
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="none" id="shadow-none" />
//                                             <Label htmlFor="shadow-none">None</Label>
//                                         </div>
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="sm" id="shadow-sm" />
//                                             <Label htmlFor="shadow-sm">Small</Label>
//                                         </div>
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="md" id="shadow-md" />
//                                             <Label htmlFor="shadow-md">Medium</Label>
//                                         </div>
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="lg" id="shadow-lg" />
//                                             <Label htmlFor="shadow-lg">Large</Label>
//                                         </div>
//                                     </RadioGroup>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <Label>Content Density</Label>
//                                     <RadioGroup
//                                         value={currentTheme.style.contentDensity}
//                                         onValueChange={(value: "compact" | "normal" | "spacious") =>
//                                             handleThemeChange({
//                                                 ...currentTheme,
//                                                 style: { ...currentTheme.style, contentDensity: value },
//                                             })
//                                         }
//                                         className="flex space-x-2"
//                                     >
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="compact" id="density-compact" />
//                                             <Label htmlFor="density-compact">Compact</Label>
//                                         </div>
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="normal" id="density-normal" />
//                                             <Label htmlFor="density-normal">Normal</Label>
//                                         </div>
//                                         <div className="flex items-center space-x-1">
//                                             <RadioGroupItem value="spacious" id="density-spacious" />
//                                             <Label htmlFor="density-spacious">Spacious</Label>
//                                         </div>
//                                     </RadioGroup>
//                                 </div>
//                             </div>
//                         </TabsContent>
//                     </Tabs>

//                     <DialogFooter>
//                         <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
//                             Cancel
//                         </Button>
//                         <Button onClick={handleSaveTheme}>Save Changes</Button>
//                     </DialogFooter>
//                 </DialogContent>
//             </Dialog>
//         </>
//     )
// }
