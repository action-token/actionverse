import { Subscription } from '@prisma/client'
import { create } from 'zustand'



// Define the data type
type SubscriptionData = {
    customPageAsset?: string
    pageAsset?: string
}

// Define the store type
type AddSubscriptionModalStore = {
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
    data?: SubscriptionData
    setData: (data: SubscriptionData) => void
    subscriptionToEdit: Subscription | null
    setSubscriptionToEdit: (subscription: Subscription | null) => void
    openForCreate: (data: SubscriptionData) => void
    openForEdit: (data: SubscriptionData, subscription: Subscription) => void
}

// Create the store
export const useAddSubsciptionModalStore = create<AddSubscriptionModalStore>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
    data: undefined,
    setData: (data) => set({ data }),
    subscriptionToEdit: null,
    setSubscriptionToEdit: (subscription) => set({ subscriptionToEdit: subscription }),

    // Helper to open modal for creating a new subscription
    openForCreate: (data) => set({
        isOpen: true,
        data,
        subscriptionToEdit: null
    }),

    // Helper to open modal for editing an existing subscription
    openForEdit: (data, subscription) => set({
        isOpen: true,
        data,
        subscriptionToEdit: subscription
    }),
}))
