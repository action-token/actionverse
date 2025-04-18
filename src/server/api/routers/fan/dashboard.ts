import { z } from "zod"
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc"
import { WidgetSettings } from "~/types/organization/dashboard"

// Define the widget schema
const widgetSchema = z.object({
    id: z.string(),
    size: z.enum(["small", "medium", "large"]),
    order: z.number(),
    pinned: z.boolean().optional(),
    groupId: z.string().optional(),
    customWidth: z.number().optional(),
    settings: z.record(z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())])).optional(),
})

// Update the dashboard schema to include theme
const dashboardSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    widgets: z.array(widgetSchema),
    theme: z
        .object({
            name: z.string(),
            colors: z.object({
                primary: z.string(),
                secondary: z.string(),
                accent: z.string(),
                background: z.string(),
                card: z.string(),
                text: z.string(),
                muted: z.string(),
                border: z.string(),
            }),
            font: z.object({
                family: z.string(),
                heading: z.string(),
                body: z.string(),
            }),
            style: z.object({
                borderRadius: z.number(),
                borderWidth: z.number(),
                shadowSize: z.enum(["none", "sm", "md", "lg"]),
                contentDensity: z.enum(["compact", "normal", "spacious"]),
            }),
        })
        .optional(),
    isDefault: z.boolean().optional(),
    isPublic: z.boolean().optional(),
})

// Update the save procedure to include the theme
export const dashboardRouter = createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const dashboards = await ctx.db.appearance.findMany({
            where: {
                OR: [{ creatorId: ctx.session.user.id }, { isPublic: true }],
            },
            include: {
                widgets: {
                    orderBy: {
                        order: "asc",
                    },
                },
            },
        })

        console.log(
            "Retrieved dashboards with themes:",
            dashboards.map((d) => ({
                id: d.id,
                name: d.name,
                hasTheme: !!d.theme,
            })),
        )

        return dashboards
    }),

    getDefault: publicProcedure.query(async ({ ctx }) => {
        return ctx.db.appearance.findFirst({
            where: {
                isDefault: true,
            },
            include: {
                widgets: {
                    orderBy: {
                        order: "asc",
                    },
                },
            },
        })
    }),

    getById: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        console.log("Fetching dashboard with ID:", input.id)

        const dashboard = await ctx.db.appearance.findFirst({
            where: {
                id: input.id,
                OR: [{ creatorId: ctx.session.user.id }, { isPublic: true }],
            },
            include: {
                widgets: {
                    orderBy: {
                        order: "asc",
                    },
                },
            },
        })

        if (!dashboard) {
            throw new Error("Dashboard not found")
        }

        console.log("Dashboard found:", dashboard.name)
        console.log("Dashboard theme:", dashboard.theme)
        console.log("Widget count:", dashboard.widgets.length)
        console.log(
            "Widget settings:",
            dashboard.widgets.map((w) => ({
                id: w.widgetId,
                settings: w.settings,
                settingsType: w.settings ? typeof w.settings : "undefined",
            })),
        )

        return dashboard
    }),

    save: protectedProcedure.input(dashboardSchema).mutation(async ({ ctx, input }) => {
        const { id, name, widgets, theme, isDefault, isPublic } = input

        // If isDefault is true, unset isDefault for all other dashboards
        if (isDefault) {
            await ctx.db.appearance.updateMany({
                where: {
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            })
        }

        if (id) {
            // Update existing dashboard
            // First delete all existing widgets
            await ctx.db.widget.deleteMany({
                where: {
                    appearanceId: id,
                },
            })

            // Then update the dashboard and add new widgets
            const updatedDashboard = await ctx.db.appearance.update({
                where: {
                    id,
                },
                data: {
                    name,
                    theme: theme, // Include theme in the update
                    isDefault: isDefault,
                    isPublic: isPublic,
                    widgets: {
                        create: widgets.map((widget) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            const settings = widget.settings ? JSON.parse(JSON.stringify(widget.settings)) : {}
                            return ({
                                widgetId: widget.id,
                                size: widget.size,
                                order: widget.order,
                                pinned: widget.pinned,
                                groupId: widget.groupId,
                                customWidth: widget.customWidth,
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                settings: settings,
                            }
                            )
                        }),
                    },
                },
            })

            return updatedDashboard
        } else {
            // Create new dashboard
            const newDashboard = await ctx.db.appearance.create({
                data: {
                    name,
                    creatorId: ctx.session.user.id,
                    theme: theme, // Include theme in the creation
                    isDefault: isDefault,
                    isPublic: isPublic,
                    widgets: {
                        create: widgets.map((widget) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            const settings = widget.settings ? JSON.parse(JSON.stringify(widget.settings)) : {}
                            return ({
                                widgetId: widget.id,
                                size: widget.size,
                                order: widget.order,
                                pinned: widget.pinned,
                                groupId: widget.groupId,
                                customWidth: widget.customWidth,
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                settings: settings,
                            }
                            )
                        }),
                    },
                },
            })

            return newDashboard
        }
    }),

    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        // First delete all widgets
        await ctx.db.widget.deleteMany({
            where: {
                appearanceId: input.id,
            },
        })

        // Then delete the dashboard
        return ctx.db.appearance.delete({
            where: {
                id: input.id,
            },
        })
    }),
})
