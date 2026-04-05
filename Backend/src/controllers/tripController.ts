import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';

const prisma = new PrismaClient();

export const tripController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId

    if (!tenantId) {
       return res.status(400).json({ message: 'Missing tenantId' });
    }
    const trips = await prisma.trip.findMany({
      where: { tenantId },
      include: { _count: { select: { buses: true, rounds: true } } }
    });
    res.json(trips);
  },

  create: async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId
    if (!tenantId) {
       return res.status(400).json({ message: 'Missing tenantId' });
    }
    const { name, status } = req.body;
    const trip = await prisma.trip.create({
      data: { name, status, tenantId }
    });
    res.status(201).json(trip);
  },

  update: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, status } = req.body;
    const updated = await prisma.trip.update({
      where: { id: Number(id) },
      data: { name, status }
    });
    res.json(updated);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await prisma.trip.delete({ where: { id: Number(id) } });
    res.json({ message: "Deleted" });
  }
};