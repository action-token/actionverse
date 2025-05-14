import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { createTransport, Transporter } from "nodemailer";

export const userRouter = createTRPCRouter({
  getUsers: protectedProcedure.query(({ ctx, input }) => {
    const users = ctx.db.user.findMany({ orderBy: { joinedAt: "desc" } });

    return users;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
  deleteUser: adminProcedure.input(z.string()).mutation(({ ctx, input }) => {
    return ctx.db.user.delete({ where: { id: input } });
  }),

  deleteAPost: adminProcedure.input(z.number()).mutation(({ ctx, input }) => {
    return ctx.db.post.delete({ where: { id: input } });
  }),
  sendEmail: publicProcedure
    .input(
      z.object({
        userEmail: z.string(),
        name: z.string(),
        message: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const { userEmail, name, message } = input;
      console.log("userEmail", userEmail);
      return sendEmail(input.userEmail, input.name, input.message);
    }),

  hasStorage: protectedProcedure.query(async ({ ctx }) => {
    const creator = await ctx.db.creator.findUnique({
      where: {
        id: ctx.session.user.id,
      },
    });

    return { storage: creator?.storagePub };
  }),
});

const transporter: Transporter = createTransport({
  service: "Gmail",
  auth: {
    user: process.env.NEXT_PUBLIC_NODEMAILER_USER,
    pass: process.env.NEXT_PUBLIC_NODEMAILER_PASS,
  },
});

export const sendEmail = async (userEmail: string, name: string, message: string): Promise<void> => {
  try {
    // Use the authenticated email as the "from" address
    const mailOptions = {
      from: process.env.NEXT_PUBLIC_NODEMAILER_USER,
      to: "support@action-tokens.com",
      replyTo: userEmail, // Add reply-to so support can reply directly to the user
      subject: `Support Request from ${name}`,
      // Format the email body to include user information
      html: `
        <h2>Support Request from ${name}</h2>
        <p><strong>User Email:</strong> ${userEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
      // Include plain text version as fallback
      text: `
Support Request from ${name}
User Email: ${userEmail}

Message:
${message}
      `,
    }

    const result = await transporter.sendMail(mailOptions)
    console.log("Email sent: ", result)
  } catch (error) {
    console.error("Error sending email: ", error)
    throw new Error("Failed to send email")
  }
};
