import { createHash } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

const uploadImageSchema = z.object({
  dataUrl: z
    .string()
    .min(1)
    .max(12_000_000)
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "Formato de imagen no valido"),
  folder: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9/_-]+$/, "Folder invalido")
    .optional(),
});

const cloudinaryUploadResponseSchema = z.object({
  secure_url: z.string().url(),
});

function resolveCloudinaryConfig(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  defaultFolder: string;
} | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    defaultFolder: process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "d20-vtt/tokens",
  };
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

export function buildUploadsRouter(): Router {
  const router = Router();

  router.post("/image", async (req, res) => {
    const config = resolveCloudinaryConfig();
    if (!config) {
      res.status(503).json({
        code: "UPLOAD_NOT_CONFIGURED",
        message: "Cloudinary no esta configurado en el servidor",
      });
      return;
    }

    const parsed = uploadImageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Payload de imagen invalido",
      });
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = parsed.data.folder
      ? `${config.defaultFolder}/${parsed.data.folder}`
      : config.defaultFolder;
    const paramsToSign: Record<string, string> = {
      folder,
      timestamp,
    };

    const signature = signCloudinaryParams(paramsToSign, config.apiSecret);

    const body = new URLSearchParams();
    body.set("file", parsed.data.dataUrl);
    body.set("api_key", config.apiKey);
    body.set("timestamp", timestamp);
    body.set("folder", folder);
    body.set("signature", signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

    try {
      const cloudinaryResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const cloudinaryPayload: unknown = await cloudinaryResponse.json();
      if (!cloudinaryResponse.ok) {
        res.status(502).json({
          code: "UPLOAD_FAILED",
          message: "Cloudinary rechazo la imagen",
        });
        return;
      }

      const parsedUpload = cloudinaryUploadResponseSchema.safeParse(cloudinaryPayload);
      if (!parsedUpload.success) {
        res.status(502).json({
          code: "UPLOAD_FAILED",
          message: "Respuesta invalida de Cloudinary",
        });
        return;
      }

      res.status(201).json({
        url: parsedUpload.data.secure_url,
      });
    } catch (error: unknown) {
      console.error("Error subiendo imagen a Cloudinary", error);
      res.status(502).json({
        code: "UPLOAD_FAILED",
        message: "No se pudo subir la imagen",
      });
    }
  });

  return router;
}
