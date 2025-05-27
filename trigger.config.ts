import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  build: {
    extensions: [
      prismaExtension({
        schema: "prisma/schema.prisma",
      }),
    ],
  },
  maxDuration: 100,
  project: "proj_jpbjlbvynaybljrerfxv",
  dirs: ["./src/trigger"],
});
