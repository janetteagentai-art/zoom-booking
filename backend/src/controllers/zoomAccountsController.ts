import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { ZoomAccount } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const repo = () => AppDataSource.getRepository(ZoomAccount);

export const CreateZoomAccountSchema = z.object({
  label: z.string().min(1),
  email: z.string().email().optional(),
  zoomUserId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  zoomAccountId: z.string().optional(),
  zoomClientId: z.string().optional(),
  zoomClientSecret: z.string().optional(),
});

export const UpdateZoomAccountSchema = z.object({
  label: z.string().min(1).optional(),
  email: z.string().email().optional(),
  zoomUserId: z.string().optional(),
  isActive: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  zoomAccountId: z.string().optional(),
  zoomClientId: z.string().optional(),
  zoomClientSecret: z.string().optional(),
});

export async function listZoomAccounts(_req: Request, res: Response) {
  const accounts = await repo().find({ order: { createdAt: 'ASC' } });
  res.json(accounts);
}

export async function createZoomAccount(req: Request, res: Response) {
  try {
    const body = CreateZoomAccountSchema.parse(req.body);
    const existing = await repo().findOne({ where: { email: body.email } as any });
    if (existing && body.email) {
      res.status(409).json({ error: 'Esa cuenta ya existe' });
      return;
    }

    const account = repo().create({
      label: body.label,
      email: body.email || '',
      zoomUserId: body.zoomUserId || '',
      isActive: true,
      color: body.color || '#6b7280',
      zoomAccountId: body.zoomAccountId || '',
      zoomClientId: body.zoomClientId || '',
      zoomClientSecret: body.zoomClientSecret || '',
    });
    await repo().save(account);
    const { zoomClientSecret, ...rest } = account;
    res.status(201).json(rest);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function updateZoomAccount(req: Request, res: Response) {
  try {
    const account = await repo().findOne({ where: { id: req.params.id } });
    if (!account) {
      res.status(404).json({ error: 'No encontrada' });
      return;
    }

    const body = UpdateZoomAccountSchema.parse(req.body);
    Object.assign(account, body);
    await repo().save(account);
    const { zoomClientSecret, ...rest } = account;
    res.json(rest);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function deleteZoomAccount(req: Request, res: Response) {
  const account = await repo().findOne({ where: { id: req.params.id } });
  if (!account) {
    res.status(404).json({ error: 'No encontrada' });
    return;
  }
  await repo().remove(account);
  res.json({ ok: true });
}
