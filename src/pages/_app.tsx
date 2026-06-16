import "mapbox-gl/dist/mapbox-gl.css";

import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";

import { api } from "~/utils/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Roboto, Lobster, Roboto_Slab, Rowdies } from "next/font/google";
import "~/styles/globals.css";

// Markdown editor styles (library + project override). Loaded globally
// because the editor renders into a portal-style tree that can't be
// styled via CSS Modules.
import "@uiw/react-md-editor/markdown-editor.css";
import "~/components/bounty/markdown-editor.css";

import Layout from "~/components/layout/root/RootLayout";
import { ShareBountyModal } from "~/components/modal/share-bounty-modal";

const queryClient = new QueryClient();

const PopupImports = dynamic(
    async () =>
        await import("package/connect_wallet/src/components/popup_imports"),
);

const inner = Roboto_Slab({
    subsets: ["latin"],
    weight: ["300", "400", "700"],
});

const MyApp: AppType<{ session: Session | null }> = ({
    Component,
    pageProps: { session, ...pageProps },
}) => {
    return (
        <SessionProvider session={session}>
            <QueryClientProvider client={queryClient}>
                <Layout className={inner.className}>
                    <Component {...pageProps} />

                </Layout>
                <PopupImports className={inner.className} />
                <ShareBountyModal />
            </QueryClientProvider>
        </SessionProvider>
    );
};

export default api.withTRPC(MyApp);