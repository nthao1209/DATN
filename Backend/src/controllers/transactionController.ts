import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';

const prisma = new PrismaClient();

const pickEarlierDate = (current?: Date | null, incoming?: Date | null): Date | null => {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  return current < incoming ? current : incoming;
};

const syncBusRoundStatusTimes = async (
  busId: number,
  roundId: number,
  checkInAt?: Date | null,
  checkOutAt?: Date | null
) => {
  if (!checkInAt && !checkOutAt) return;

  const current = await prisma.busRoundStatus.findUnique({
    where: { busId_roundId: { busId, roundId } },
  });

  const nextCheckInAt = checkInAt ? pickEarlierDate(current?.checkInAt, checkInAt) : null;
  const nextCheckOutAt = checkOutAt ? pickEarlierDate(current?.checkOutAt, checkOutAt) : null;

  await prisma.busRoundStatus.upsert({
    where: { busId_roundId: { busId, roundId } },
    create: {
      busId,
      roundId,
      checkInLocked: false,
      checkOutLocked: false,
      checkInAt: nextCheckInAt,
      checkOutAt: nextCheckOutAt,
    },
    update: {
      ...(nextCheckInAt ? { checkInAt: nextCheckInAt } : {}),
      ...(nextCheckOutAt ? { checkOutAt: nextCheckOutAt } : {}),
    },
  });
};

const ensureTenant = (req: AuthRequest, res: Response): number | null => {
  if (!req.tenantId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return req.tenantId;
};

const canAccessTransactions = (req: AuthRequest) => req.roleId === 2 || req.roleId === 3 || req.roleId === 1;

const hasLockedAttendanceChange = (
  locked: boolean | undefined,
  currentValue: boolean | undefined,
  incomingValue: boolean | undefined
) => Boolean(locked) && incomingValue !== undefined && incomingValue !== Boolean(currentValue);

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
      const incomingCheckInAt = req.body?.checkInAt ? new Date(req.body.checkInAt) : undefined;
      const incomingCheckOutAt = req.body?.checkOutAt ? new Date(req.body.checkOutAt) : undefined;
      const incomingNote = req.body?.note ? String(req.body.note).trim() : null;
      let actorId = req.user?.id ?? null;
      console.log(req.user);
      console.log(req.firebaseUser);
      if (!actorId && req.firebaseUser?.uid) {
        try {
          const possibleUser = await prisma.user.findUnique({ where: { firebaseUid: req.firebaseUser.uid } });
          if (possibleUser) {
            actorId = possibleUser.id;
          }
        } catch (e) {
          console.warn('Fallback user lookup failed', e);
        }
      }

      if (!actorId) {
        console.warn('transaction.create: actorId is null (request may be unauthenticated). req.user:', req.user?.id, 'req.firebaseUser:', req.firebaseUser?.uid);
      }

      // Check BusRoundStatus locks
      const brs = await prisma.busRoundStatus.findUnique({ where: { busId_roundId: { busId, roundId } } });
      if (brs) {
        if (hasLockedAttendanceChange(brs.checkInLocked, existing?.checkIn, incomingCheckIn)) {
          return res.status(403).json({ message: 'Check-in for this bus/round is locked' });
        }
        if (hasLockedAttendanceChange(brs.checkOutLocked, existing?.checkOut, incomingCheckOut)) {
          return res.status(403).json({ message: 'Check-out for this bus/round is locked' });
        }
      }

      const nextCheckIn = existing
        ? Boolean(existing.checkIn) || Boolean(incomingCheckIn)
        : Boolean(incomingCheckIn);
      const nextCheckOut = existing
        ? Boolean(existing.checkOut) || Boolean(incomingCheckOut)
        : Boolean(incomingCheckOut);

      // Determine earliest timestamps between existing and incoming
      const now = new Date();
      const actorTimeIn = incomingCheckInAt ?? now;
      const actorTimeOut = incomingCheckOutAt ?? now;

      const checkInAt = nextCheckIn
        ? (existing?.checkInAt ? (existing.checkInAt < actorTimeIn ? existing.checkInAt : actorTimeIn) : actorTimeIn)
        : null;

      const checkOutAt = nextCheckOut
        ? (existing?.checkOutAt ? (existing.checkOutAt < actorTimeOut ? existing.checkOutAt : actorTimeOut) : actorTimeOut)
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
          checkInAt: checkInAt,
          checkInBy: nextCheckIn ? (existing?.checkInBy ?? actorId) : null,
          checkOutAt: checkOutAt,
          checkOutBy: nextCheckOut ? (existing?.checkOutBy ?? actorId) : null,
          note: incomingNote
        },
        create: {
          busId: Number(busId),
          roundId: Number(roundId),
          passengerId: Number(passengerId),
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          checkInAt: checkInAt,
          checkInBy: nextCheckIn ? actorId : null,
          checkOutAt: checkOutAt,
          checkOutBy: nextCheckOut ? actorId : null,
          note: incomingNote
        }
      });

      await syncBusRoundStatusTimes(
        busId,
        roundId,
        nextCheckIn ? checkInAt : null,
        nextCheckOut ? checkOutAt : null
      );

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
      const incomingCheckInAt = req.body?.checkInAt ? new Date(req.body.checkInAt) : undefined;
      const incomingCheckOutAt = req.body?.checkOutAt ? new Date(req.body.checkOutAt) : undefined;

      let actorId = req.user?.id ?? null;
      if (!actorId && req.firebaseUser?.uid) {
        try {
          const possibleUser = await prisma.user.findUnique({ where: { firebaseUid: req.firebaseUser.uid } });
          if (possibleUser) actorId = possibleUser.id;
        } catch (e) {
          console.warn('Fallback user lookup failed', e);
        }
      }

      // enforce BusRoundStatus locks
      const brs = await prisma.busRoundStatus.findUnique({ where: { busId_roundId: { busId: existing.busId, roundId: existing.roundId } } });
      if (brs) {
        if (hasLockedAttendanceChange(brs.checkInLocked, existing.checkIn, checkInInput !== undefined ? Boolean(checkInInput) : undefined)) {
          return res.status(403).json({ message: 'Check-in for this bus/round is locked' });
        }
        if (hasLockedAttendanceChange(brs.checkOutLocked, existing.checkOut, checkOutInput !== undefined ? Boolean(checkOutInput) : undefined)) {
          return res.status(403).json({ message: 'Check-out for this bus/round is locked' });
        }
      }

      const nextCheckIn = checkInInput !== undefined
        ? Boolean(checkInInput)
        : existing.checkIn;

      const nextCheckOut = checkOutInput !== undefined
        ? Boolean(checkOutInput)
        : existing.checkOut;

      const now = new Date();
      const actorTimeIn = incomingCheckInAt ?? now;
      const actorTimeOut = incomingCheckOutAt ?? now;

      const nextCheckInAt = checkInInput === undefined
        ? existing.checkInAt
        : nextCheckIn
          ? (existing.checkInAt ? (existing.checkInAt < actorTimeIn ? existing.checkInAt : actorTimeIn) : actorTimeIn)
          : null;

      const nextCheckOutAt = checkOutInput === undefined
        ? existing.checkOutAt
        : nextCheckOut
          ? (existing.checkOutAt ? (existing.checkOutAt < actorTimeOut ? existing.checkOutAt : actorTimeOut) : actorTimeOut)
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

      await syncBusRoundStatusTimes(
        existing.busId,
        existing.roundId,
        nextCheckIn ? nextCheckInAt : null,
        nextCheckOut ? nextCheckOutAt : null
      );

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
