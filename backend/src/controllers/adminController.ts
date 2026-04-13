import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { Professor } from '../entities';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const repo = () => AppDataSource.getRepository(Professor);

export const CreateProfessorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['professor', 'admin']).default('professor'),
});

export const UpdateProfessorSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['professor', 'admin']).optional(),
});

export async function listProfessors(_req: Request, res: Response) {
  const professors = await repo().find({
    select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'],
    order: { createdAt: 'ASC' },
  });
  res.json(professors);
}

export async function createProfessor(req: Request, res: Response) {
  try {
    const body = CreateProfessorSchema.parse(req.body);

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
    res.status(201).json({
      id: professor.id,
      email: professor.email,
      name: professor.name,
      role: professor.role,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function updateProfessor(req: Request, res: Response) {
  try {
    const body = UpdateProfessorSchema.parse(req.body);
    const professor = await repo().findOne({ where: { id: req.params.id } });
    if (!professor) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }

    Object.assign(professor, body);
    await repo().save(professor);
    res.json({
      id: professor.id,
      email: professor.email,
      name: professor.name,
      role: professor.role,
      isActive: professor.isActive,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function deleteProfessor(req: Request, res: Response) {
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
}
