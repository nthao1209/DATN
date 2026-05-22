"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockRequestController = void 0;
const client_1 = require("@prisma/client");
const notificationService_1 = require("../services/notificationService");
const mqtt_1 = require("../services/mqtt");
const prisma = new client_1.PrismaClient();
const buildUnlockTitle = (status) => {
    switch (status) {
        case 'PENDING':
            return 'Yêu cầu mở khóa mới';
        case 'APPROVED':
            return 'Yêu cầu mở khóa đã được duyệt';
        case 'REJECTED':
            return 'Yêu cầu mở khóa bị từ chối';
    }
};
const buildUnlockContent = (request, busCode, roundName, extra) => {
    const actionLabel = request.type === 'check_in' ? 'điểm danh vào' : 'điểm danh ra';
    const base = `Xe ${busCode || request.bus?.busCode || request.busId} yêu cầu mở khóa ${actionLabel} cho chặng ${roundName || request.round?.name || request.roundId}`;
    return extra ? `${base}. ${extra}` : `${base}.`;
};
const unlockRequestInclude = {
    bus: {
        include: {
            trip: true,
        },
    },
    round: true,
};
const notifyAdmins = async (tenantId, handledBy, payload) => {
    let recipientIds = await (0, notificationService_1.getTenantNotificationRecipients)(prisma, tenantId);
    recipientIds = recipientIds.filter((id) => id !== handledBy);
    if (!recipientIds.length)
        return;
    await (0, notificationService_1.createNotificationsForUsers)(prisma, recipientIds, payload);
};
const getPendingRequests = async (req, res) => {
    try {
        if (!req.tenantId) {
            return res.status(401).json({
                message: 'Unauthorized',
            });
        }
        const tripId = Number(req.query.tripId);
        const roundId = Number(req.query.roundId);
        if (!tripId || !roundId) {
            return res.status(400).json({
                message: 'Missing tripId or roundId',
            });
        }
        const requests = await prisma.unlockRequest.findMany({
            where: {
                status: 'PENDING',
                roundId,
                bus: {
                    trip: {
                        id: tripId,
                        tenantId: req.tenantId,
                    },
                },
            },
            include: {
                bus: {
                    include: {
                        manager: true,
                    },
                },
                round: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json(requests);
    }
    catch (error) {
        console.error('get pending unlock requests error:', error);
        return res.status(500).json({
            message: error.message,
        });
    }
};
const create = async (req, res) => {
    try {
        const busId = Number(req.params.busId);
        const roundId = Number(req.params.roundId);
        const { type = 'check_in', reason } = req.body || {};
        if (!busId || !roundId) {
            return res.status(400).json({ message: 'Missing busId or roundId' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (!req.tenantId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const bus = await prisma.bus.findFirst({
            where: { id: busId, trip: { tenantId: req.tenantId } },
            include: { trip: true, manager: true },
        });
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }
        const round = await prisma.round.findFirst({
            where: { id: roundId, trip: { tenantId: req.tenantId } },
        });
        if (!round) {
            return res.status(404).json({ message: 'Round not found' });
        }
        const existingRequest = await prisma.unlockRequest.findFirst({
            where: { busId, roundId, type },
            include: unlockRequestInclude,
        });
        const request = existingRequest
            ? await prisma.unlockRequest.update({
                where: { id: existingRequest.id },
                data: {
                    reason: reason ? String(reason) : null,
                    requestedBy: req.user.id,
                    status: 'PENDING',
                    handledBy: null,
                    respondedAt: null,
                },
                include: unlockRequestInclude,
            })
            : await prisma.unlockRequest.create({
                data: {
                    busId,
                    roundId,
                    type,
                    reason: reason ? String(reason) : null,
                    requestedBy: req.user.id,
                    status: 'PENDING',
                },
                include: unlockRequestInclude,
            });
        await notifyAdmins(req.tenantId, req.user.id, {
            type: 'unlock.request.created',
            title: buildUnlockTitle('PENDING'),
            content: buildUnlockContent(request, bus.busCode, round.name, reason ? `Lý do: ${reason}` : undefined),
            payload: {
                requestId: request.id,
                busId,
                roundId,
                tripId: bus.trip.id,
                lockType: type,
            }
        });
        await (0, notificationService_1.createNotification)(prisma, {
            userId: req.user.id,
            type: 'unlock.request.created.self',
            title: 'Yêu cầu mở khóa đã được gửi',
            content: `Yêu cầu mở khóa đã gửi cho chặng ${round.name} (Xe ${bus.busCode}).`,
            payload: {
                requestId: request.id,
                busId,
                roundId,
                tripId: bus.trip.id,
                lockType: type,
            },
        });
        const requesterTopic = `attendance/requester/${req.user.id}/unlock-response`;
        (0, mqtt_1.publishJson)(requesterTopic, {
            type: 'unlock.request.created.self',
            requestId: request.id,
            busId,
            busCode: bus.busCode,
            roundId,
            roundName: round.name,
            lockType: type,
            reason: reason || '',
            tripId: bus.trip.id,
            requestedBy: req.user.id,
            status: 'PENDING',
        });
        // Publish to admin-only topic for realtime UI refresh
        const adminTopic = `attendance/trips/${bus.trip.id}/admin/unlock-requests`;
        (0, mqtt_1.publishJson)(adminTopic, {
            type: 'unlock.request.created',
            requestId: request.id,
            busId,
            busCode: bus.busCode,
            roundId,
            roundName: round.name,
            lockType: type,
            reason: reason || '',
            tripId: bus.trip.id,
            requestedBy: req.user.id,
            status: 'PENDING',
        });
        return res.status(201).json(request);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};
const approve = async (req, res) => {
    try {
        const requestId = Number(req.params.requestId);
        if (!requestId)
            return res.status(400).json({ message: 'Missing requestId' });
        if (!req.user?.id)
            return res.status(401).json({ message: 'Unauthorized' });
        if (!req.tenantId)
            return res.status(401).json({ message: 'Unauthorized' });
        const request = await prisma.unlockRequest.findUnique({
            where: { id: requestId },
            include: unlockRequestInclude
        });
        if (!request) {
            return res.status(404).json({ message: 'Unlock request not found' });
        }
        if (request.bus.trip.tenantId !== req.tenantId) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        const updated = await prisma.$transaction(async (tx) => {
            const updatedRequest = await tx.unlockRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    handledBy: req.user?.id,
                    respondedAt: new Date(),
                }
            });
            await tx.busRoundStatus.update({
                where: {
                    busId_roundId: {
                        busId: request.busId,
                        roundId: request.roundId,
                    }
                },
                data: request.type === 'check_in'
                    ? {
                        checkInLocked: false,
                        checkInAt: null,
                    }
                    : {
                        checkOutLocked: false,
                        checkOutAt: null,
                    }
            });
            return updatedRequest;
        });
        await (0, notificationService_1.createNotification)(prisma, {
            userId: request.requestedBy,
            type: 'unlock.request.approved',
            title: buildUnlockTitle('APPROVED'),
            content: buildUnlockContent(request, request.bus.busCode, undefined, `Đã được phê duyệt bởi ${req.user.name || req.user.email || req.user.id}`),
            payload: {
                requestId,
                busId: request.busId,
                roundId: request.roundId,
                tripId: request.bus.trip.id,
                handledBy: req.user.id,
            },
        });
        const lockPayload = {
            type: 'bus.round.lock.updated',
            tripId: request.bus.trip.id,
            busId: request.busId,
            roundId: request.roundId,
            checkInLocked: request.type === 'check_in' ? false : undefined,
            checkOutLocked: request.type === 'check_out' ? false : undefined,
            updatedAt: new Date().toISOString(),
            handledBy: req.user.id,
        };
        (0, mqtt_1.publishJson)('attendance/ui/locks', lockPayload);
        (0, mqtt_1.publishJson)(`attendance/trips/${request.bus.trip.id}/locks`, lockPayload);
        // Notify requester in realtime (no system-wide broadcast)
        (0, mqtt_1.publishJson)(`attendance/requester/${request.requestedBy}/unlock-response`, {
            type: 'unlock.request.approved',
            requestId,
            busId: request.busId,
            roundId: request.roundId,
            busCode: request.bus.busCode,
            roundName: request.round?.name,
            lockType: request.type,
            handledBy: req.user.id,
        });
        const adminTopic = `attendance/trips/${request.bus.trip.id}/admin/unlock-requests`;
        (0, mqtt_1.publishJson)(adminTopic, {
            type: 'unlock.request.approved',
            requestId,
            busId: request.busId,
            roundId: request.roundId,
            handledBy: req.user.id,
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('approve unlock error:', error);
        return res.status(500).json({ message: error.message });
    }
};
/**
 * REJECT unlock request
 */
const reject = async (req, res) => {
    try {
        const requestId = Number(req.params.requestId);
        const { rejectReason } = req.body;
        if (!requestId)
            return res.status(400).json({ message: 'Missing requestId' });
        if (!req.user?.id)
            return res.status(401).json({ message: 'Unauthorized' });
        if (!req.tenantId)
            return res.status(401).json({ message: 'Unauthorized' });
        const request = await prisma.unlockRequest.findUnique({
            where: { id: requestId },
            include: unlockRequestInclude
        });
        if (!request) {
            return res.status(404).json({ message: 'Unlock request not found' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        const updated = await prisma.$transaction(async (tx) => {
            const updatedRequest = await tx.unlockRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    handledBy: req.user?.id,
                    respondedAt: new Date(),
                }
            });
            return updatedRequest;
        });
        // Notify requester only
        await (0, notificationService_1.createNotification)(prisma, {
            userId: request.requestedBy,
            type: 'unlock.request.rejected',
            title: buildUnlockTitle('REJECTED'),
            content: buildUnlockContent(request, request.bus.busCode, undefined, `Lý do: ${rejectReason || 'Không có'}`),
            payload: {
                requestId,
                busId: request.busId,
                roundId: request.roundId,
                tripId: request.bus.trip.id,
                handledBy: req.user.id,
                rejectReason: rejectReason || '',
            },
        });
        // Notify requester in realtime (no system-wide broadcast)
        (0, mqtt_1.publishJson)(`attendance/requester/${request.requestedBy}/unlock-response`, {
            type: 'unlock.request.rejected',
            requestId,
            busId: request.busId,
            roundId: request.roundId,
            busCode: request.bus.busCode,
            roundName: request.round?.name,
            lockType: request.type,
            handledBy: req.user.id,
            rejectReason: rejectReason || '',
        });
        const adminTopic = `attendance/trips/${request.bus.trip.id}/admin/unlock-requests`;
        (0, mqtt_1.publishJson)(adminTopic, {
            type: 'unlock.request.rejected',
            requestId,
            busId: request.busId,
            roundId: request.roundId,
            handledBy: req.user.id,
            rejectReason: rejectReason || '',
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('reject unlock error:', error);
        return res.status(500).json({ message: error.message });
    }
};
exports.unlockRequestController = {
    getPendingRequests,
    create,
    approve,
    reject,
};
