import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';

const prisma = new PrismaClient();

const ensureTenant = (req: AuthRequest, res: Response): number | null => {
  if (!req.tenantId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return req.tenantId;
};

const canAccessTransactions = (req: AuthRequest) => req.roleId === 2 || req.roleId === 3 || req.roleId === 1;

export const transactionController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;
      if (!canAccessTransactions(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const managerCondition = req.roleId === 3 && req.user?.id
        ? {
            OR: [
              {
                bus: {
                  managerId: req.user.id,
                  trip: {
                    tenantId
                  }
                }
              },
              {
                passenger: {
                  bus: {
                    managerId: req.user.id,
                    trip: {
                      tenantId
                    }
                  }
                }
              }
            ]
          }
        : {
            bus: {
              trip: {
                tenantId
              }
            }
          };

      const transactions = await prisma.transaction.findMany({
        where: managerCondition,
        include: {
          passenger: {
            include: {
              bus: {
                select: {
                  id: true,
                  busCode: true,
                  registrationNumber: true
                }
              }
            }
          },
          round: true,
          checkInUser: {
            select: { id: true, name: true, email: true }
          },
          checkOutUser: {
            select: { id: true, name: true, email: true }
          },
          bus: {
            select: {
              id: true,
              busCode: true,
              registrationNumber: true
            }
          }
        },
        orderBy: [{ roundId: 'asc' }, { busId: 'asc' }, { passengerId: 'asc' }]
      });

      res.json(transactions);
    } catch (error: any) {
      console.error('get transactions error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;
      if (!canAccessTransactions(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const busId = Number(req.body?.busId);
      const roundId = Number(req.body?.roundId);
      const passengerId = Number(req.body?.passengerId);

      if (!busId || !roundId || !passengerId) {
        return res.status(400).json({ message: 'busId, roundId, passengerId are required' });
      }

      const bus = await prisma.bus.findFirst({
        where: { id: busId, trip: { tenantId } }
      });
      if (!bus) return res.status(404).json({ message: 'Bus not found' });

      const round = await prisma.round.findFirst({
        where: { id: roundId, trip: { tenantId } }
      });
      if (!round) return res.status(404).json({ message: 'Round not found' });

      const passenger = await prisma.passenger.findFirst({
        where: {
          id: passengerId,
          bus: {
            trip: { tenantId }
          }
        }
      });
      if (!passenger) return res.status(404).json({ message: 'Passenger not found' });

      const existing = await prisma.transaction.findUnique({
        where: {
          passengerId_roundId: {
            passengerId,
            roundId
          }
        }
      });

      const incomingCheckIn = req.body?.checkIn !== undefined ? Boolean(req.body?.checkIn) : undefined;
      const incomingCheckOut = req.body?.checkOut !== undefined ? Boolean(req.body?.checkOut) : undefined;
      const incomingNote = req.body?.note ? String(req.body.note).trim() : null;
      const actorId = req.user?.id ?? null;

      const nextCheckIn = existing
        ? Boolean(existing.checkIn) || Boolean(incomingCheckIn)
        : Boolean(incomingCheckIn);
      const nextCheckOut = existing
        ? Boolean(existing.checkOut) || Boolean(incomingCheckOut)
        : Boolean(incomingCheckOut);

      const checkInAt = nextCheckIn
        ? existing?.checkInAt ?? new Date()
        : null;
      const checkOutAt = nextCheckOut
        ? existing?.checkOutAt ?? new Date()
        : null;

      const created = await prisma.transaction.upsert({
        where: {
          passengerId_roundId: {
            passengerId,
            roundId
          }
        },
        update: {
          busId,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          checkInAt: nextCheckIn ? (existing?.checkInAt ?? new Date()) : null,
          checkInBy: nextCheckIn ? (existing?.checkInBy ?? actorId) : null,
          checkOutAt: nextCheckOut ? (existing?.checkOutAt ?? new Date()) : null,
          checkOutBy: nextCheckOut ? (existing?.checkOutBy ?? actorId) : null,
          note: incomingNote
        },
        create: {
          busId: Number(busId),
          roundId: Number(roundId),
          passengerId: Number(passengerId),
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          checkInAt: nextCheckIn ? new Date() : null,
          checkInBy: nextCheckIn ? actorId : null,
          checkOutAt: nextCheckOut ? new Date() : null,
          checkOutBy: nextCheckOut ? actorId : null,
          note: incomingNote
        }
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('create transaction error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;
      if (!canAccessTransactions(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ message: 'Invalid transaction id' });
      }

      const existing = await prisma.transaction.findFirst({
        where: {
          id,
          bus: {
            trip: {
              tenantId
            }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const checkInInput = req.body?.checkIn;
      const checkOutInput = req.body?.checkOut;
      const actorId = req.user?.id ?? null;

      const nextCheckIn = checkInInput !== undefined
        ? Boolean(checkInInput)
        : existing.checkIn;

      const nextCheckOut = checkOutInput !== undefined
        ? Boolean(checkOutInput)
        : existing.checkOut;

      const nextCheckInAt = checkInInput === undefined
        ? existing.checkInAt
        : nextCheckIn
          ? (existing.checkInAt ?? new Date())
          : null;

      const nextCheckOutAt = checkOutInput === undefined
        ? existing.checkOutAt
        : nextCheckOut
          ? (existing.checkOutAt ?? new Date())
          : null;

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          ...(checkInInput !== undefined ? { checkIn: nextCheckIn } : {}),
          ...(checkOutInput !== undefined ? { checkOut: nextCheckOut } : {}),
          ...(checkInInput !== undefined ? { checkInAt: nextCheckInAt, checkInBy: nextCheckIn ? existing.checkInBy ?? actorId : null } : {}),
          ...(checkOutInput !== undefined ? { checkOutAt: nextCheckOutAt, checkOutBy: nextCheckOut ? existing.checkOutBy ?? actorId : null } : {}),
          ...(req.body?.note !== undefined ? { note: req.body.note ? String(req.body.note).trim() : null } : {})
        }
      });

      res.json(updated);
    } catch (error: any) {
      console.error('update transaction error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  delete: async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;
      if (!canAccessTransactions(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ message: 'Invalid transaction id' });
      }

      const existing = await prisma.transaction.findFirst({
        where: {
          id,
          bus: {
            trip: {
              tenantId
            }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      await prisma.transaction.delete({ where: { id } });
      res.json({ message: 'Deleted successfully' });
    } catch (error: any) {
      console.error('delete transaction error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  }
};
