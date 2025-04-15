"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, ChevronDown, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { useAddSubsciptionModalStore } from "~/components/store/add-subscription-modal-store"
import { Label } from "~/components/shadcn/ui/label"
import { Input } from "~/components/shadcn/ui/input"
import { api } from "~/utils/api"
import { DialogDescription } from "@radix-ui/react-dialog"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Switch } from "~/components/shadcn/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { cn } from "~/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/shadcn/ui/form"
import { RadioGroup, RadioGroupItem } from "~/components/shadcn/ui/radio-group"

// Define the form schema with validation rules
const subscriptionSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(2, "Package name is required").max(10, "Package name must be less than 10 characters"),
    price: z.coerce.number().min(0.01, "Price must be greater than 0"),
    description: z.string().min(1, "Description is required"),
    features: z.array(z.string().min(1, "Feature cannot be empty")),
    color: z.string(),
    popular: z.boolean().default(false),
    isActive: z.boolean().default(true),
})

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

const colorOptions = [
    { value: "bg-blue-500", label: "Blue", textColor: "text-blue-500" },
    { value: "bg-green-500", label: "Green", textColor: "text-green-500" },
    { value: "bg-purple-500", label: "Purple", textColor: "text-purple-500" },
    { value: "bg-pink-500", label: "Pink", textColor: "text-pink-500" },
    { value: "bg-orange-500", label: "Orange", textColor: "text-orange-500" },
    { value: "bg-red-500", label: "Red", textColor: "text-red-500" },
    { value: "bg-yellow-500", label: "Yellow", textColor: "text-yellow-500" },
    { value: "bg-indigo-500", label: "Indigo", textColor: "text-indigo-500" },
]

const SubscriptionModal = () => {
    const { isOpen, setIsOpen, data, subscriptionToEdit } = useAddSubsciptionModalStore()
    const [isEditMode, setIsEditMode] = useState(false)

    // API mutations
    const addNewSubs = api.fan.creator.addCreatorSubscription.useMutation()
    const updateSubs = api.fan.creator.updateCreatorSubscription.useMutation()

    // Initialize form with React Hook Form and Zod validation
    const form = useForm<SubscriptionFormValues>({
        resolver: zodResolver(subscriptionSchema),
        defaultValues: {

            name: "",
            price: 0,
            description: "",
            features: [""],
            color: "bg-blue-500",
            popular: false,
            isActive: true,
        },
    })

    const {
        watch,
        setValue,
        getValues,
        reset,
        formState: { errors, isDirty },
    } = form

    // Set form values when editing an existing subscription
    useEffect(() => {
        if (subscriptionToEdit) {
            setIsEditMode(true)
            reset({
                id: subscriptionToEdit.id,
                name: subscriptionToEdit.name,
                price: subscriptionToEdit.price,
                description: subscriptionToEdit.description,
                features: subscriptionToEdit.features.length ? subscriptionToEdit.features : [""],
                color: subscriptionToEdit.color,
                popular: subscriptionToEdit.popular,
                isActive: subscriptionToEdit.isActive,
            })
        } else {
            setIsEditMode(false)
            reset({

                name: "",
                price: 0,
                description: "",
                features: [""],
                color: "bg-blue-500",
                popular: false,
                isActive: true,
            })
        }
    }, [subscriptionToEdit, reset])

    // Watch form values for the preview
    const watchedValues = watch()

    // Add a new feature field
    const addFeatureField = () => {
        const currentFeatures = getValues("features")
        setValue("features", [...currentFeatures, ""])
    }

    // Remove a feature field
    const removeFeature = (index: number) => {
        const currentFeatures = getValues("features")
        if (currentFeatures.length > 1) {
            setValue(
                "features",
                currentFeatures.filter((_, i) => i !== index),
            )
        }
    }

    // Handle form submission
    const onSubmit = (values: SubscriptionFormValues) => {
        if (isEditMode && values.id) {
            // Update existing subscription
            updateSubs.mutate(
                {
                    id: values.id,
                    name: values.name,
                    price: values.price,
                    color: values.color,
                    description: values.description,
                    features: values.features,
                    popular: values.popular,
                    isActive: values.isActive,
                },
                {
                    onSuccess: () => {
                        handleClose()
                    },
                },
            )
        } else {
            // Create new subscription
            addNewSubs.mutate(
                {
                    name: values.name,
                    price: values.price,
                    color: values.color,
                    description: values.description,
                    features: values.features,
                    popular: values.popular,
                    isActive: values.isActive,
                },
                {
                    onSuccess: () => {
                        handleClose()
                    },
                },
            )
        }
    }

    // Reset form and close modal
    const handleClose = () => {
        reset({
            name: "",
            price: 0,
            description: "",
            features: [""],
            color: "bg-blue-500",
            popular: false,
            isActive: true,
        })
        setIsEditMode(false)
        setIsOpen(false)
    }

    // Determine if the form is submitting
    const isSubmitting = addNewSubs.isLoading ?? updateSubs.isLoading

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] max-w-[95vw] max-h-[85vh] sm:max-w-[800px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Edit Subscription Package" : "Create Subscription Package"}</DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Update your subscription package details."
                            : "Create a new subscription package for your fans."}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="edit">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="edit">Edit</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>

                    <TabsContent value="edit">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                {/* Hidden ID field for updates */}
                                {isEditMode && (
                                    <FormField
                                        control={form.control}
                                        name="id"
                                        render={({ field }) => <input type="hidden" {...field} />}
                                    />
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Package Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Basic, Premium" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Price</FormLabel>
                                                <FormControl>
                                                    <div className="flex">
                                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                                                            {data?.customPageAsset ? data.customPageAsset.split("-")[0] : data?.pageAsset?.code}
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            className="rounded-l-none"
                                                            min={0}
                                                            step={0.01}
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Describe what subscribers will get" rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Package Color</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                                                    {colorOptions.map((color) => (
                                                        <div key={color.value} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={color.value} id={color.value} className="sr-only" />
                                                            <Label
                                                                htmlFor={color.value}
                                                                className={cn(
                                                                    "flex items-center justify-center w-10 h-10 rounded-full cursor-pointer border-2",
                                                                    field.value === color.value ? "border-primary" : "border-transparent",
                                                                )}
                                                            >
                                                                <div className={cn("w-8 h-8 rounded-full", color.value)} />
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Features</Label>
                                        <Button variant="ghost" size="sm" onClick={addFeatureField} type="button">
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add
                                        </Button>
                                    </div>

                                    {form.watch("features").map((feature, index) => (
                                        <div key={index} className="flex gap-2">
                                            <FormField
                                                control={form.control}
                                                name={`features.${index}`}
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormControl>
                                                            <Input {...field} placeholder={`Feature ${index + 1}`} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeFeature(index)}
                                                type="button"
                                                disabled={form.watch("features").length <= 1}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                                    <FormField
                                        control={form.control}
                                        name="popular"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                                <FormLabel>Mark as popular</FormLabel>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="isActive"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                                <FormLabel>Active package</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter className="pt-4">
                                    <Button variant="outline" onClick={handleClose} type="button">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting
                                            ? isEditMode
                                                ? "Updating..."
                                                : "Creating..."
                                            : isEditMode
                                                ? "Update Package"
                                                : "Create Package"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>

                    <TabsContent value="preview">
                        <div className="py-4">
                            <h3 className="text-lg font-medium mb-4">Package Preview</h3>
                            <div className="max-w-md mx-auto">
                                <Card
                                    className={cn(
                                        "relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200",
                                        watchedValues.popular ? "border-primary" : "border-border",
                                        !watchedValues.isActive && "opacity-60",
                                    )}
                                >
                                    <div className={cn("h-2", watchedValues.color)} />
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle>{watchedValues.name ?? "Package Name"}</CardTitle>
                                                <div className="flex items-baseline mt-2">
                                                    <span className="text-3xl font-bold">${watchedValues.price ?? 0}</span>
                                                    <span className="text-muted-foreground ml-1">/{data?.pageAsset?.code}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {watchedValues.popular && (
                                            <div className="absolute top-0 right-0">
                                                <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                                    POPULAR
                                                </div>
                                            </div>
                                        )}
                                        <CardDescription className="mt-2">
                                            {watchedValues.description ?? "Package description goes here"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pb-2">
                                        <ul className="space-y-2">
                                            {watchedValues.features.map((feature, i) =>
                                                feature ? (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                        <span>{feature}</span>
                                                    </li>
                                                ) : null,
                                            )}
                                        </ul>

                                        {watchedValues.features.length > 2 && (
                                            <Button variant="ghost" size="sm" className="w-full text-xs" type="button">
                                                <ChevronDown className="h-4 w-4 mr-1" />
                                                Show All Features
                                            </Button>
                                        )}
                                    </CardContent>
                                    <CardFooter>
                                        <div className="flex items-center justify-between w-full">
                                            <Badge variant={watchedValues.isActive ? "default" : "outline"}>
                                                {watchedValues.isActive ? "Active" : "Inactive"}
                                            </Badge>

                                        </div>
                                    </CardFooter>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

export default SubscriptionModal

