import { Router, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { ZoomAccount } from '../entities';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const repo = () => AppDataSource.getRepository(ZoomAccount);

const CreateSchema = z.object({
  label: z.string().min(1),
  email: z.string().email().optional(),
  zoomUserId: z.string().optional(),
});

// GET /zoom-accounts (admin only)
router.get('/', authenticate, requireAdmin, async (_req, res) => {
  const accounts = await repo().find({ order: { createdAt: 'ASC' } });
  res.json(accounts);
});

// POST /zoom-accounts (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const body = CreateSchema.parse(req.body);
    const existing = await repo().findOne({ where: { email: body.email } });
    if (existing && body.email) {
      res.status(409).json({ error: 'Esa cuenta ya existe' });
      return;
    }

    const account = repo().create({
      label: body.label,
      email: body.email || '',
      zoomUserId: body.zoomUserId || '',
      isActive: true,
    });
    await repo().save(account);
    res.status(201).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /zoom-accounts/:id (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const account = await repo().findOne({ where: { id: req.params.id } });
    if (!account) {
      res.status(404).json({ error: 'No encontrada' });
      return;
    }

    const body = z.object({
      label: z.string().min(1).optional(),
      email: z.string().email().optional(),
      zoomUserId: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    Object.assign(account, body);
    await repo().save(account);
    res.json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /zoom-accounts/:id (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const account = await repo().findOne({ where: { id: req.params.id } });
  if (!account) {
    res.status(404).json({ error: 'No encontrada' });
    return;
  }
  await repo().remove(account);
  res.json({ ok: true });
});

export default router;
