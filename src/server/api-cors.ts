import { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";

export async function EnableCors(req: NextApiRequest, res: NextApiResponse) {
  return;
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "https://60c705ba9924.ngrok-free.app",

    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
}
