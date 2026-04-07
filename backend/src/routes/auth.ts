import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/data-source';
import { Professor } from '../entities';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const professorRepo = () => AppDataSource.getRepository(Professor);

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(p: Professor): string {
  return jwt.sign(
    { id: p.id, email: p.email, role: p.role },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const body = RegisterSchema.parse(req.body);

    const existing = await professorRepo().findOne({
      where: { email: body.email },
    });
    if (existing) {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const professor = professorRepo().create({
      email: body.email,
      password: hashed,
      name: body.name,
      role: 'professor',
    });

    await professorRepo().save(professor);

    const token = signToken(professor);
    res.status(201).json({ token, professor: { id: professor.id, email: professor.email, name: professor.name, role: professor.role } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const body = LoginSchema.parse(req.body);

    const professor = await professorRepo().findOne({
      where: { email: body.email },
    });

    if (!professor || !(await bcrypt.compare(body.password, professor.password))) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const token = signToken(professor);
    res.json({ token, professor: { id: professor.id, email: professor.email, name: professor.name, role: professor.role } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
