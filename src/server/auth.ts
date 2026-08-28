/* eslint-disable */
import { verifyMessageSignature } from "@albedo-link/signature-verification";
import axios from "axios";
import { type GetServerSidePropsContext } from "next";

import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";

import CredentialsProvider from "next-auth/providers/credentials";

import {
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { WalletType } from "package/connect_wallet";
import {
  appleTokenToUser,
  verifyIdToken,
} from "package/connect_wallet/src/lib/firebase/admin/auth";
import { initAdmin } from "package/connect_wallet/src/lib/firebase/admin/config";
import { auth } from "package/connect_wallet/src/lib/firebase/firebase-auth";
import { getPublicKeyAPISchema } from "package/connect_wallet/src/lib/stellar/wallet_clients/type";
import { z } from "zod";
import { db } from "~/server/db";
import { AuthCredentialType } from "~/types/auth";
import { truncateString } from "~/utils/string";

import { USER_ACCOUNT_URL } from "package/connect_wallet/src/lib/stellar/constant";
import { verifyXDRSignature } from "package/connect_wallet/src/lib/stellar/trx/deummy";
import { env } from "~/env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
type User = DefaultSession["user"] & {
  id: string;
  walletType: WalletType;
  emailVerified: boolean;
  // ...other properties
  // role: UserRole;
};

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: User;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          walletType: token.walletType,
          emailVerified: token.emailVerified,
        },
      };
    },
    jwt: ({ user, token }) => {
      const u = user as User;
      if (u) {
        token.walletType = u.walletType;
        token.emailVerified = u.emailVerified;
      }
      return token;
    },
  },
  // adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      type: "credentials",
      credentials: {},
      async authorize(credentials): Promise<User | null> {
        const cred = credentials as AuthCredentialType;

        // email pass login
        if (cred.walletType == WalletType.emailPass) {
          const { email, password, fromAppSign } = cred;
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
          );
          const user = userCredential.user;

          if (!user.emailVerified) {
            await sendEmailVerification(user);
            const errorCode = "auth/unverified-email";
            throw new Error(`Firebase: Error (${errorCode}).`);
          }
          const data = await getUserPublicKey({ email: email, uid: user.uid, fromAppSign });
          const sessionUser = await dbUser(
            data.publicKey,
            fromAppSign,
            email,
            WalletType.emailPass,
          );
          return {
            ...sessionUser,
            walletType: WalletType.emailPass,
            email: email,
            emailVerified: user.emailVerified,
          };
        }

        // wallet login
        if (cred.walletType == WalletType.albedo) {
          const { pubkey, signature, token, fromAppSign } = cred;

          const isValid = verifyMessageSignature(pubkey, token, signature);
          if (isValid) {
            const sessionUser = await dbUser(
              pubkey,
              fromAppSign,
              undefined,
              cred.walletType,
            );
            return {
              ...sessionUser,
              walletType: WalletType.albedo,
              emailVerified: true,
            };
          }
          throw new Error("Invalid signature");
        }
        // wallet rabet and frieghter
        if (
          cred.walletType == WalletType.rabet ||
          cred.walletType == WalletType.frieghter ||
          cred.walletType == WalletType.walletConnect ||
          cred.walletType == WalletType.metamask ||
          cred.walletType == WalletType.xBull ||
          cred.walletType == WalletType.hana ||
          cred.walletType == WalletType.hotWallet
        ) {
          const { pubkey, signedXDR, fromAppSign } = cred;
          const isValid = await verifyXDRSignature({
            publicKey: pubkey,
            xdr: signedXDR,
          });
          if (isValid) {
            const sessionUser = await dbUser(
              pubkey,
              fromAppSign,
              undefined,
              cred.walletType,
            );
            return {
              ...sessionUser,
              walletType: cred.walletType,
              emailVerified: true,
            };
          }
          throw new Error("Invalid signature");
        }

        // provider logins
        if (
          cred.walletType == WalletType.google ||
          cred.walletType == WalletType.facebook
        ) {
          const { token, email, fromAppSign } = cred;

          const { uid } = await verifyIdToken(token);
          const data = await getUserPublicKey({ uid, email, fromAppSign });
          const sessionUser = await dbUser(
            data.publicKey,
            fromAppSign,
            email,
            cred.walletType,
          );
          return {
            ...sessionUser,
            walletType: cred.walletType,
            email: email,
            emailVerified: true,
          };
        }

        if (cred.walletType == WalletType.apple) {
          const { appleToken, token, email, fromAppSign } = cred;

          if (token) {
            const { uid } = await verifyIdToken(token);
            const data = await getUserPublicKey({ uid, email, fromAppSign });
            const sessionUser = await dbUser(
              data.publicKey,
              fromAppSign,
              email,
              cred.walletType,
            );
            return {
              ...sessionUser,
              walletType: cred.walletType,
              emailVerified: true,
              email: email,
            };
          } else {
            if (appleToken) {
              const { uid } = await appleTokenToUser(appleToken, email);

              const data = await getUserPublicKey({ uid, email, fromAppSign });
              const sessionUser = await dbUser(
                data.publicKey,
                fromAppSign,
                email,
                cred.walletType,
              );
              return {
                ...sessionUser,
                walletType: cred.walletType,
                emailVerified: true,
                email: email,
              };
            }
          }
        }

        return null;
      },
    }),
  ],


};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};

export async function dbUser(
  pubkey: string,
  fromAppSign?: string,
  email?: string,
  signUpMethod?: string,
) {
  const user = await db.user.findUnique({ where: { id: pubkey } });
  // if user exists, check if email is set, if not set it
  if (user) {
    const profileEmail = user.email;
    if (!profileEmail && email) {
      await db.user.update({
        where: { id: pubkey },
        data: { email: email },
      });
    }
    const firstSignUpMethod = user.firstSignUpMethod;
    if (!firstSignUpMethod && signUpMethod) {
      await db.user.update({
        where: { id: pubkey },
        data: {
          firstSignUpMethod: signUpMethod,
        },
      });
    }

    return user;
  } else {
    const data = await db.user.create({
      data: {
        id: pubkey,
        name: truncateString(pubkey),
        fromAppSignup: fromAppSign === "true" ? true : false,
        email: email,
        firstSignUpMethod: signUpMethod,
      },
    });
    return data;
  }
}

async function getUserPublicKey({
  uid,
  email,
  fromAppSign
}: {
  uid: string;
  email: string;
  fromAppSign: string | undefined;
}) {
  const res = await axios.get<z.infer<typeof getPublicKeyAPISchema>>(
    USER_ACCOUNT_URL,
    {
      params: {
        uid,
        email,
        from: env.NEXT_PUBLIC_ASSET_CODE ?? "ACTION",
        fromAppSign: fromAppSign ? "true" : "false",
      },
    },
  );
  return res.data;
}

/**
 * Find-or-create the custodial account for a guest card checkout, entirely
 * server-side — no session, no password. Mirrors what a normal email/social
 * sign-in already does via `getUserPublicKey`/`dbUser` above, just resolving
 * the Firebase user by email instead of via an authenticated sign-in.
 */
export async function resolveOrCreateCustodialAccount(
  email: string,
): Promise<{ pubkey: string; isNewAccount: boolean }> {
  const adminAuth = initAdmin().auth();
  let uid: string;
  let isNewAccount: boolean;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
    isNewAccount = false;
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    uid = (await adminAuth.createUser({ email })).uid;
    isNewAccount = true;
  }
  const { publicKey } = await getUserPublicKey({ uid, email, fromAppSign: undefined });
  await dbUser(publicKey, undefined, email, WalletType.emailPass);
  return { pubkey: publicKey, isNewAccount };
}

/**
 * Read-only counterpart to `resolveOrCreateCustodialAccount` — for pricing a
 * guest quote or checking activation status before any charge happens.
 * Deliberately a local DB read only, never Firebase or `getUserPublicKey`:
 * the external key service can silently activate/fund an inactive account
 * as a side effect of merely resolving its pubkey, which must never happen
 * before a real charge. `null` means "no local record yet," priced as
 * new/inactive.
 */
export async function lookupExistingCustodialPubkey(email: string): Promise<string | null> {
  const user = await db.user.findFirst({ where: { email } });
  return user?.id ?? null;
}
