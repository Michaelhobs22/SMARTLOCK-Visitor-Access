import { randomBytes } from "node:crypto";
import { getAuth } from "@clerk/express";
import {
  CreatePassBody,
  CreatePassResponse,
  ImportLegacyPassesBody,
  ImportLegacyPassesResponse,
  ListPassesResponse,
  LookupPublicPassBody,
  LookupPublicPassResponse,
  RevokePassParams,
  RevokePassResponse,
  VerifyPassBody,
  VerifyPassResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { accessPassesTable } from "@workspace/db/schema";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const legacyTokenPattern = /^SL-[A-F0-9]{20}$/i;

function residentId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

function unauthorized(res: Response) {
  return res.status(401).json({ error: "Sign in to manage visitor passes." });
}

function badRequest(res: Response) {
  return res.status(400).json({ error: "The pass details are invalid." });
}

function notFound(res: Response) {
  return res.status(404).json({ error: "Pass not found." });
}

router.get("/passes", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  const passes = await db
    .select()
    .from(accessPassesTable)
    .where(eq(accessPassesTable.ownerId, ownerId))
    .orderBy(desc(accessPassesTable.createdAt));

  return res.json(ListPassesResponse.parse(passes));
});

router.post("/passes", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  const parsed = CreatePassBody.safeParse(req.body);
  if (!parsed.success) return badRequest(res);

  const visitorName = parsed.data.visitorName.trim();
  const unit = parsed.data.unit.trim().toUpperCase();
  const expiresAt = parsed.data.expiresAt;
  if (
    !visitorName ||
    !unit ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return badRequest(res);
  }

  const token = `SL-${randomBytes(20).toString("hex").toUpperCase()}`;
  const [pass] = await db
    .insert(accessPassesTable)
    .values({
      id: `pass-${token}`,
      ownerId,
      visitorName,
      unit,
      accessType: parsed.data.accessType,
      token,
      expiresAt,
      status: "active",
      notes: parsed.data.notes?.trim() || null,
    })
    .returning();

  return res.status(201).json(CreatePassResponse.parse(pass));
});

router.post("/passes/import-legacy", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  const parsed = ImportLegacyPassesBody.safeParse(req.body);
  if (!parsed.success) return badRequest(res);

  let importedCount = 0;
  await db.transaction(async (tx) => {
    for (const pass of parsed.data.passes) {
      // Preserve old visitor links while rejecting demo fixtures and any
      // client-supplied IDs that do not match the original generated format.
      if (!legacyTokenPattern.test(pass.token) || pass.id !== `pass-${pass.token}`) {
        continue;
      }

      const [inserted] = await tx
        .insert(accessPassesTable)
        .values({
          id: pass.id,
          ownerId,
          visitorName: pass.visitorName.trim(),
          unit: pass.unit.trim().toUpperCase(),
          accessType: pass.accessType,
          token: pass.token.toUpperCase(),
          createdAt: pass.createdAt,
          expiresAt: pass.expiresAt,
          status: pass.revokedAt || pass.status === "revoked"
            ? "revoked"
            : pass.usedAt || pass.status === "used"
              ? "used"
              : "active",
          notes: pass.notes?.trim() || null,
          usedAt: pass.usedAt ?? null,
          revokedAt: pass.revokedAt ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: accessPassesTable.id });

      if (inserted) importedCount += 1;
    }
  });

  return res.json(ImportLegacyPassesResponse.parse({ importedCount }));
});

router.post("/passes/verify", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  const parsed = VerifyPassBody.safeParse(req.body);
  if (!parsed.success) return badRequest(res);

  const token = parsed.data.token.trim().toUpperCase();
  const accessTime = new Date();
  const [usedPass] = await db
    .update(accessPassesTable)
    .set({ status: "used", usedAt: accessTime })
    .where(
      and(
        eq(accessPassesTable.ownerId, ownerId),
        eq(accessPassesTable.token, token),
        eq(accessPassesTable.status, "active"),
        isNull(accessPassesTable.usedAt),
        isNull(accessPassesTable.revokedAt),
        gt(accessPassesTable.expiresAt, accessTime),
      ),
    )
    .returning();

  if (usedPass) {
    return res.json(
      VerifyPassResponse.parse({
        ok: true,
        reason: null,
        pass: usedPass,
        accessTime,
      }),
    );
  }

  const [pass] = await db
    .select()
    .from(accessPassesTable)
    .where(
      and(
        eq(accessPassesTable.ownerId, ownerId),
        eq(accessPassesTable.token, token),
      ),
    )
    .limit(1);

  if (!pass) {
    return res.json(
      VerifyPassResponse.parse({
        ok: false,
        reason: "Invalid visitor credential.",
        pass: null,
        accessTime: null,
      }),
    );
  }

  const reason =
    pass.status === "revoked" || pass.revokedAt
      ? "This pass has been revoked."
      : pass.status === "used" || pass.usedAt
        ? "This pass has already been used."
        : "This pass has expired.";

  return res.json(
    VerifyPassResponse.parse({
      ok: false,
      reason,
      pass,
      accessTime: null,
    }),
  );
});

router.post("/passes/:id/revoke", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  const params = RevokePassParams.safeParse(req.params);
  if (!params.success) return badRequest(res);

  const [existing] = await db
    .select()
    .from(accessPassesTable)
    .where(
      and(
        eq(accessPassesTable.ownerId, ownerId),
        eq(accessPassesTable.id, params.data.id),
      ),
    )
    .limit(1);

  if (!existing) return notFound(res);
  if (existing.status !== "active" || existing.expiresAt.getTime() <= Date.now()) {
    return res.status(409).json({ error: "This pass is no longer active." });
  }

  const revokedAt = new Date();
  const [revokedPass] = await db
    .update(accessPassesTable)
    .set({ status: "revoked", revokedAt })
    .where(
      and(
        eq(accessPassesTable.ownerId, ownerId),
        eq(accessPassesTable.id, params.data.id),
        eq(accessPassesTable.status, "active"),
        isNull(accessPassesTable.usedAt),
        isNull(accessPassesTable.revokedAt),
        gt(accessPassesTable.expiresAt, revokedAt),
      ),
    )
    .returning();

  if (!revokedPass) {
    return res.status(409).json({ error: "This pass is no longer active." });
  }

  return res.json(RevokePassResponse.parse(revokedPass));
});

router.delete("/passes", async (req, res) => {
  const ownerId = residentId(req);
  if (!ownerId) return unauthorized(res);

  await db.delete(accessPassesTable).where(eq(accessPassesTable.ownerId, ownerId));
  return res.status(204).end();
});

router.post("/public-passes/lookup", async (req, res) => {
  const parsed = LookupPublicPassBody.safeParse(req.body);
  if (!parsed.success) return badRequest(res);

  const [pass] = await db
    .select()
    .from(accessPassesTable)
    .where(eq(accessPassesTable.id, parsed.data.passId))
    .limit(1);

  if (!pass) return notFound(res);

  return res.json(
    LookupPublicPassResponse.parse({
      id: pass.id,
      visitorName: pass.visitorName,
      unit: pass.unit,
      accessType: pass.accessType,
      token: pass.token,
      createdAt: pass.createdAt,
      expiresAt: pass.expiresAt,
      status: pass.status,
      usedAt: pass.usedAt,
      revokedAt: pass.revokedAt,
    }),
  );
});

export default router;
