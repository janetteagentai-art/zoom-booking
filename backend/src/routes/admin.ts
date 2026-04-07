import { Router, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Professor } from '../entities';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const repo = () => AppDataSource.getRepository(Professor);

// GET /admin/professors
router.get('/professors', authenticate, requireAdmin, async (_req, res) => {
  const professors = await repo().find({
    select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'],
    order: { createdAt: 'ASC' },
  });
  res.json(professors);
});

// PATCH /admin/professors/:id
router.patch('/professors/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const professor = await repo().findOne({ where: { id: req.params.id } });
    if (!professor) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }

    const body = z.object({
      name: z.string().min(2).optional(),
      isActive: z.boolean().optional(),
      role: z.enum(['professor', 'admin']).optional(),
    }).parse(req.body);

    Object.assign(professor, body);
    await repo().save(professor);
    res.json({ id: professor.id, email: professor.email, name: professor.name, role: professor.role, isActive: professor.isActive });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /admin/professors/:id
router.delete('/professors/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const professor = await repo().findOne({ where: { id: req.params.id } });
  if (!professor) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  if (professor.role === 'admin') {
    res.status(400).json({ error: 'No podés eliminar un admin' });
    return;
  }
  await repo().remove(professor);
  res.json({ ok: true });
});

// POST /admin/professors (manual create)
router.post('/professors', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bcrypt = require('bcryptjs');
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(2),
      role: z.enum(['professor', 'admin']).default('professor'),
    }).parse(req.body);

    const existing = await repo().findOne({ where: { email: body.email } });
    if (existing) {
      res.status(409).json({ error: 'El email ya existe' });
      return;
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const professor = repo().create({
      email: body.email,
      password: hashed,
      name: body.name,
      role: body.role,
    });
    await repo().save(professor);
    res.status(201).json({ id: professor.id, email: professor.email, name: professor.name, role: professor.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
