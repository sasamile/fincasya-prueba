import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET_NAME || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const ALLOWED_FIELDS = new Set([
  "bankCertificationUrl",
  "idCopyUrl",
  "rntPdfUrl",
  "chamberOfCommerceUrl",
]);

/** Sube un documento legal del propietario a S3 y devuelve la URL pública. */
export async function POST(request: Request) {
  try {
    if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json(
        { error: "Faltan credenciales AWS para subir el documento." },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const field = String(form.get("field") ?? "").trim();
    const propertyId = String(form.get("propertyId") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: "Campo inválido" }, { status: 400 });
    }
    if (!propertyId) {
      return NextResponse.json(
        { error: "Falta la propiedad" },
        { status: 400 },
      );
    }

    const mime = file.type || "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isPdf =
      mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes o PDF" },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es muy grande (máx. 8 MB)" },
        { status: 400 },
      );
    }

    const ext =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      (isPdf ? "pdf" : "jpg");
    const objectKey = `owner-docs/${propertyId}/${field}-${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
        Body: bytes,
        ContentType: mime,
      }),
    );

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${objectKey}`;
    return NextResponse.json({ ok: true, url, field, propertyId });
  } catch (error) {
    console.error("[owner documents POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir el documento",
      },
      { status: 500 },
    );
  }
}
