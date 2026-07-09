import fs from 'node:fs';
import { workerData, parentPort } from 'node:worker_threads';
import mqtt from 'mqtt';
import pkg from 'pg';
const { Pool } = pkg;
const ATTENDANCE_TOPIC_REGEX = /^attendance\/[^/]+\/[^/]+\/[^/]+\/check$/;
const parseInteger = (value) => {
    // Payload MQTT có thể là string hoặc number, nên chuẩn hóa về integer trước khi ghi DB.
    if (value === undefined || value === null || value === '')
        return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
};
const parseBoolean = (value) => {
    // Frontend/localStorage/MQTT có thể biểu diễn boolean khác nhau, worker gom về boolean thật.
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true')
            return true;
        if (normalized === 'false')
            return false;
    }
    if (typeof value === 'number')
        return value === 1;
    return false;
};
const readTrimmedNote = (value) => {
    // undefined nghĩa là không đụng vào ghi chú; null/chuỗi rỗng nghĩa là xóa ghi chú.
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};
const readEventAt = (timestamp) => {
    // Tin nhắn offline có timestamp cũ, worker giữ thời điểm thao tác thay vì thời điểm nhận MQTT.
    if (!timestamp)
        return new Date();
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};
const pickEarlierDate = (current, incoming) => {
    if (!incoming)
        return current ?? null;
    if (!current)
        return incoming;
    return current < incoming ? current : incoming;
};
const syncBusRoundStatusTimes = async (db, busId, roundId, checkInAt, checkOutAt) => {
    // Lưu mốc check-in/check-out đầu tiên của bus-round để admin theo dõi thời điểm bắt đầu/kết thúc.
    if (!checkInAt && !checkOutAt)
        return;
    const currentRes = await db.query(`
        SELECT "checkInAt", "checkOutAt"
        FROM "BusRoundStatus"
        WHERE "busId" = $1
          AND "roundId" = $2
        `, [busId, roundId]);
    const current = currentRes.rows[0];
    const nextCheckInAt = checkInAt
        ? pickEarlierDate(current?.checkInAt, checkInAt)
        : null;
    const nextCheckOutAt = checkOutAt
        ? pickEarlierDate(current?.checkOutAt, checkOutAt)
        : null;
    await db.query(`
        INSERT INTO "BusRoundStatus"
        (
            "busId",
            "roundId",
            "checkInLocked",
            "checkOutLocked",
            "checkInAt",
            "checkOutAt"
        )
        VALUES ($1, $2, false, false, $3, $4)
        ON CONFLICT ("busId", "roundId")
        DO UPDATE SET
            "checkInAt" = COALESCE($3, "BusRoundStatus"."checkInAt"),
            "checkOutAt" = COALESCE($4, "BusRoundStatus"."checkOutAt")
        `, [busId, roundId, nextCheckInAt, nextCheckOutAt]);
};
const createNotification = async (db, userId, type, title, content, payload) => {
    // Tạo notification sai xe nhưng chống trùng theo transaction/passenger/eventType.
    if (!Number.isInteger(userId) || userId <= 0) {
        return;
    }
    const exists = await db.query(`
        SELECT id
        FROM "Notification"
        WHERE "userId" = $1
          AND type = $2
          AND (payload->>'transactionId')::int = $3
          AND (payload->>'passengerId')::int = $4
          AND payload->>'eventType' = $5
        ORDER BY "createdAt" DESC, id DESC
        LIMIT 1
        `, [
        userId,
        type,
        Number(payload.transactionId || 0),
        Number(payload.passengerId || 0),
        String(payload.eventType || ''),
    ]);
    if (exists.rows.length > 0)
        return;
    await db.query(`
        INSERT INTO "Notification"
        (
            "userId",
            type,
            title,
            content,
            payload,
            "isRead",
            "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, false, NOW())
        `, [userId, type, title, content, JSON.stringify(payload)]);
};
async function init() {
    let config;
    try {
        // Worker nhận đường dẫn config từ master để có thể chạy.
        const rawConfig = fs.readFileSync(workerData.configPath, 'utf8');
        config = JSON.parse(rawConfig);
    }
    catch (e) {
        parentPort?.postMessage(`Config error: ${e.message}`);
        return;
    }
    const prj = config.project_name;
    const mqttQos = Math.min(Math.max(Number(config.mqtt.qos ?? 1), 0), 2);
    const pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
    });
    const mqttClient = mqtt.connect(`${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`, {
        username: config.mqtt.username,
        password: config.mqtt.password,
        clientId: `worker_${prj}_${Math.random().toString(16).slice(3)}`,
        clean: true,
    });
    const uiTopicPrefix = config.mqtt.uiTopicPrefix || 'attendance/ui/trip';
    const dashboardTopicPrefix = config.mqtt.dashboardTopicPrefix || 'dashboard/tenant';
    const ackTopicPrefix = 'attendance/ack/action';
    const loadBusCode = async (db, busId) => {
        const busRes = await db.query(`
            SELECT "busCode"
            FROM "Bus"
            WHERE id = $1
            `, [busId]);
        return busRes.rows[0]?.busCode || busId;
    };
    const resolveEventBusIdByActor = async (db, actorId, tripId, fallbackBusId) => {
        // Nếu actor là quản lý xe khác, event phải ghi nhận xe của actor thay vì xe fallback.
        // Đây là điểm tách xe gốc và xe thực tế: khách vẫn thuộc xe gốc, event đi theo xe người thao tác.
        if (!actorId)
            return fallbackBusId;
        const actorBusRes = await db.query(`
            SELECT id
            FROM "Bus"
            WHERE "tripId" = $1
              AND "managerId" = $2
            ORDER BY id ASC
            LIMIT 1
            `, [tripId, actorId]);
        return actorBusRes.rows[0]?.id ?? fallbackBusId;
    };
    const loadBusRoundLockForUpdate = async (db, targetBusId, targetRoundId) => {
        // Neu chua co row thi tao mac dinh chua khoa; neu da co thi giu nguyen trang thai hien tai.
        // Khóa được lưu theo từng cặp xe-chặng, nên phải tạo row mặc định trước khi SELECT FOR UPDATE.
        await db.query(`
            INSERT INTO "BusRoundStatus"
            (
                "busId",
                "roundId",
                "checkInLocked",
                "checkOutLocked"
            )
            VALUES ($1, $2, false, false)
            ON CONFLICT ("busId", "roundId") DO NOTHING
            `, [targetBusId, targetRoundId]);
        const statusRes = await db.query(`
            SELECT
                "checkInLocked",
                "checkOutLocked",
                "driverConfirmedBy"
            FROM "BusRoundStatus"
            WHERE "busId" = $1
              AND "roundId" = $2
            FOR UPDATE
            `, [targetBusId, targetRoundId]);
        return statusRes.rows[0];
    };
    const assertAttendanceUnlocked = async (db, options) => {
        // Cache status theo busId de neu check-in/check-out cung mot xe thi khong SELECT lai.
        // Kiểm tra khóa theo xe thực tế của event, nên khách sai xe vẫn bị chặn nếu xe thực tế đã khóa.
        const lockedStatuses = new Map();
        const getStatus = async (targetBusId) => {
            const existing = lockedStatuses.get(targetBusId);
            if (existing) {
                return existing;
            }
            const status = await loadBusRoundLockForUpdate(db, targetBusId, options.roundId);
            lockedStatuses.set(targetBusId, status);
            return status;
        };
        if (options.willWriteCheckIn) {
            const status = await getStatus(options.checkInBusId);
            if (status.driverConfirmedBy) {
                throw new Error(`Chặng của xe ${options.checkInBusId} đã được xác nhận hoàn tất, không thể sửa điểm danh lượt đi`);
            }
            if (status.checkInLocked) {
                throw new Error(`Lượt đi của xe ${options.checkInBusId} đã khóa, không thể sửa điểm danh`);
            }
        }
        if (options.willWriteCheckOut) {
            const status = await getStatus(options.checkOutBusId);
            if (status.driverConfirmedBy) {
                throw new Error(`Chặng của xe ${options.checkOutBusId} đã được xác nhận hoàn tất, không thể sửa điểm danh lượt về`);
            }
            if (status.checkOutLocked) {
                throw new Error(`Lượt về của xe ${options.checkOutBusId} đã khóa, không thể sửa điểm danh`);
            }
        }
    };
    // Xóa retained message sau khi xử lý để worker restart không ghi lại cùng action.
    const clearRetainedTopic = (topic) => {
        mqttClient.publish(topic, '', {
            qos: mqttQos,
            retain: true,
        });
    };
    const handleAttendanceMessage = async (topic, data) => {
        // Luồng chính: nhận payload attendance từ MQTT, validate, ghi Transaction/Event, publish UI update.
        if (!ATTENDANCE_TOPIC_REGEX.test(topic)) {
            return;
        }
        const passengerId = parseInteger(data.passengerId);
        const roundId = parseInteger(data.roundId);
        const busId = parseInteger(data.busId);
        if (!passengerId || !roundId || !busId) {
            throw new Error('Thiếu passengerId, roundId hoặc busId');
        }
        const incomingCheckIn = parseBoolean(data.checkIn);
        const incomingCheckOut = parseBoolean(data.checkOut);
        // Touched flags cho worker biết người dùng thật sự sửa cột nào để tránh ghi đè.
        const hasTouchedFlags = data.checkInTouched !== undefined ||
            data.checkOutTouched !== undefined ||
            data.checkInNoteTouched !== undefined ||
            data.checkOutNoteTouched !== undefined;
        const checkInTouched = hasTouchedFlags
            ? parseBoolean(data.checkInTouched)
            : true;
        const checkOutTouched = hasTouchedFlags
            ? parseBoolean(data.checkOutTouched)
            : true;
        const checkInNoteTouched = hasTouchedFlags
            ? parseBoolean(data.checkInNoteTouched)
            : data.checkInNote !== undefined;
        const checkOutNoteTouched = hasTouchedFlags
            ? parseBoolean(data.checkOutNoteTouched)
            : data.checkOutNote !== undefined;
        const eventAt = readEventAt(data.timestamp);
        const incomingCheckInNote = readTrimmedNote(data.checkInNote);
        const incomingCheckOutNote = readTrimmedNote(data.checkOutNote);
        const actionId = typeof data.actionId === 'string' && data.actionId.trim()
            ? data.actionId.trim()
            : null;
        const checkInBy = incomingCheckIn
            ? parseInteger(data.checkInBy)
            : null;
        const checkOutBy = incomingCheckOut
            ? parseInteger(data.checkOutBy)
            : null;
        const db = await pool.connect();
        try {
            // Toàn bộ validate, kiểm tra khóa, ghi transaction và ghi event nằm trong một DB transaction.
            await db.query('BEGIN');
            // Validate bus/passenger/round cùng chuyến trước khi ghi transaction.
            const busRes = await db.query(`
                SELECT
                    b.id,
                    b."busCode",
                    b."registrationNumber",
                    b."tripId",
                    t."tenantId"
                FROM "Bus" b
                JOIN "Trip" t
                    ON t.id = b."tripId"
                WHERE b.id = $1
                `, [busId]);
            const bus = busRes.rows[0];
            if (!bus) {
                throw new Error(`Không tìm thấy xe: ${busId}`);
            }
            const passengerRes = await db.query(`
                SELECT
                    p.id,
                    p.name,
                    p."busId",
                    b."busCode",
                    b."registrationNumber",
                    b."managerId"
                FROM "Passenger" p
                JOIN "Bus" b
                    ON b.id = p."busId"
                WHERE p.id = $1
                `, [passengerId]);
            const passenger = passengerRes.rows[0];
            if (!passenger) {
                throw new Error(`Không tìm thấy hành khách: ${passengerId}`);
            }
            const roundRes = await db.query(`
                SELECT id, name
                FROM "Round"
                WHERE id = $1
                  AND "tripId" = $2
                `, [roundId, bus.tripId]);
            const round = roundRes.rows[0];
            if (!round) {
                throw new Error(`Không tìm thấy vòng: ${roundId}`);
            }
            // Xác định xe thực tế của từng event theo người thao tác.
            // Nếu trưởng xe khác điểm danh khách này thì event mang xe của trưởng xe đó.
            const eventCheckInBusId = await resolveEventBusIdByActor(db, checkInBy, bus.tripId, busId);
            const eventCheckOutBusId = await resolveEventBusIdByActor(db, checkOutBy, bus.tripId, busId);
            const [checkInBusCode, checkOutBusCode] = await Promise.all([
                // Lấy tên xe thực tế để tự sinh ghi chú khi khách bị điểm danh sai xe.
                loadBusCode(db, eventCheckInBusId),
                loadBusCode(db, eventCheckOutBusId),
            ]);
            const existingRes = await db.query(
            // Một passenger chỉ có một transaction cho mỗi round.
            // Vì vậy các lần điểm danh sau update cùng transaction thay vì tạo thêm dòng trùng.
            `
                SELECT *
                FROM "Transaction"
                WHERE "passengerId" = $1
                  AND "roundId" = $2
                `, [passengerId, roundId]);
            const existing = existingRes.rows[0];
            // Tính trạng thái tiếp theo dựa trên payload và bản ghi hiện có.
            // Cột không được touched sẽ giữ nguyên giá trị cũ để tránh action offline ghi đè nhầm.
            const isNewTransaction = !existing;
            const nextCheckIn = checkInTouched
                ? incomingCheckIn
                : Boolean(existing?.checkIn);
            const nextCheckOut = checkOutTouched
                ? incomingCheckOut
                : Boolean(existing?.checkOut);
            const checkInStatusChanged = checkInTouched &&
                (isNewTransaction
                    ? nextCheckIn
                    : Boolean(existing.checkIn) !== nextCheckIn);
            const checkOutStatusChanged = checkOutTouched &&
                (isNewTransaction
                    ? nextCheckOut
                    : Boolean(existing.checkOut) !== nextCheckOut);
            const hasAttendanceStatusChanged = checkInStatusChanged || checkOutStatusChanged;
            // Nếu hành khách được điểm danh trên xe khác xe biên chế,
            // tự sinh ghi chú để người quản lý nhìn bảng là thấy ngay khách đang ở xe nào.
            const autoCheckInNote = Number(passenger.busId) !== Number(eventCheckInBusId)
                ? `Khách đang ở trên xe ${checkInBusCode}`
                : null;
            const autoCheckOutNote = Number(passenger.busId) !== Number(eventCheckOutBusId)
                ? `Khách đang ở trên xe ${checkOutBusCode}`
                : null;
            const nextCheckInNote = checkInStatusChanged
                ? nextCheckIn
                    ? incomingCheckInNote ?? autoCheckInNote
                    : null
                : hasTouchedFlags
                    ? checkInNoteTouched
                        ? incomingCheckInNote ?? null
                        : existing?.checkInNote ?? null
                    : incomingCheckInNote ?? existing?.checkInNote ?? null;
            const nextCheckOutNote = checkOutStatusChanged
                ? nextCheckOut
                    ? incomingCheckOutNote ?? autoCheckOutNote
                    : null
                : hasTouchedFlags
                    ? checkOutNoteTouched
                        ? incomingCheckOutNote ?? null
                        : existing?.checkOutNote ?? null
                    : incomingCheckOutNote ?? existing?.checkOutNote ?? null;
            // Kể cả UI bị bypass hoặc action offline cũ sync lại, worker vẫn chặn nếu lượt/chặng đã khóa.
            await assertAttendanceUnlocked(db, {
                roundId,
                checkInBusId: eventCheckInBusId,
                checkOutBusId: eventCheckOutBusId,
                willWriteCheckIn: checkInTouched || checkInNoteTouched,
                willWriteCheckOut: checkOutTouched || checkOutNoteTouched,
            });
            // Transaction lưu trạng thái tổng hợp mới nhất của hành khách trong một chặng.
            // Passenger.busId là xe biên chế; AttendanceEvent.busId là xe thực tế của thao tác điểm danh.
            // Transaction.busId phải luôn giữ xe biên chế để không lẫn với xe thực tế.
            const assignedBusId = Number(passenger.busId);
            const transactionRes = existing
                // Update nếu transaction đã tồn tại, insert nếu đây là lần đầu khách xuất hiện ở round.
                // busId ghi vào Transaction luôn là assignedBusId để bảng tổng hợp theo xe gốc không bị lệch.
                ? await db.query(`
                      UPDATE "Transaction"
                      SET
                          "busId" = $1,
                          "checkIn" = $2,
                          "checkOut" = $3,
                          "lastActionAt" = $4,
                          "checkInNote" = $5,
                          "checkOutNote" = $6
                      WHERE id = $7
                      RETURNING *
                      `, [
                    assignedBusId,
                    nextCheckIn,
                    nextCheckOut,
                    eventAt,
                    nextCheckInNote ?? null,
                    nextCheckOutNote ?? null,
                    existing.id,
                ])
                : await db.query(`
                      INSERT INTO "Transaction"
                      (
                          "passengerId",
                          "roundId",
                          "busId",
                          "checkIn",
                          "checkOut",
                          "lastActionAt",
                          "checkInNote",
                          "checkOutNote"
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                      RETURNING *
                      `, [
                    passengerId,
                    roundId,
                    assignedBusId,
                    nextCheckIn,
                    nextCheckOut,
                    eventAt,
                    nextCheckInNote ?? null,
                    nextCheckOutNote ?? null,
                ]);
            const result = transactionRes.rows[0];
            let eventType = null;
            if (checkInStatusChanged) {
                // AttendanceEvent là nhật ký lịch sử cho từng lần đổi trạng thái check-in.
                // Nó giữ actor, xe thực tế và thời điểm; Transaction chỉ giữ trạng thái mới nhất.
                // Ghi event lịch sử mỗi khi trạng thái check-in đổi.
                eventType = nextCheckIn
                    ? 'CHECK_IN_ON'
                    : 'CHECK_IN_OFF';
                await db.query(`
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                    result.id,
                    eventType,
                    checkInBy,
                    eventCheckInBusId,
                    nextCheckInNote ?? '',
                    eventAt,
                ]);
            }
            if (checkOutStatusChanged) {
                // Lượt về được ghi event riêng để thống kê và truy vết được xe thực tế lúc trả khách.
                // Ghi event lịch sử mỗi khi trạng thái check-out đổi.
                eventType = nextCheckOut
                    ? 'CHECK_OUT_ON'
                    : 'CHECK_OUT_OFF';
                await db.query(`
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                    result.id,
                    eventType,
                    checkOutBy,
                    eventCheckOutBusId,
                    nextCheckOutNote ?? '',
                    eventAt,
                ]);
            }
            await syncBusRoundStatusTimes(db, busId, roundId, checkInStatusChanged ? eventAt : null, checkOutStatusChanged ? eventAt : null);
            // Từ đây trở xuống chuẩn bị payload realtime và notification; dữ liệu chính đã được ghi trong DB transaction.
            // Đọc lại event mới nhất để payload realtime có đúng actor, thời điểm và xe thực tế.
            const checkInEventRes = await db.query(`
                SELECT id, "actorId", "createdAt", "busId"
                FROM "AttendanceEvent"
                WHERE "transactionId" = $1
                  AND action IN ('CHECK_IN_ON', 'CHECK_IN_OFF')
                ORDER BY "createdAt" DESC, id DESC
                LIMIT 1
                `, [result.id]);
            const checkOutEventRes = await db.query(`
                SELECT id, "actorId", "createdAt", "busId"
                FROM "AttendanceEvent"
                WHERE "transactionId" = $1
                  AND action IN ('CHECK_OUT_ON', 'CHECK_OUT_OFF')
                ORDER BY "createdAt" DESC, id DESC
                LIMIT 1
                `, [result.id]);
            const checkInEvent = (checkInEventRes.rows[0] ||
                null);
            const checkOutEvent = (checkOutEventRes.rows[0] ||
                null);
            let latestEventBusId = result.busId;
            // Chọn xe thực tế mới nhất giữa check-in và check-out.
            // Xe này được dùng để so với xe biên chế và quyết định có cảnh báo sai xe hay không.
            if (checkInEvent?.createdAt && checkOutEvent?.createdAt) {
                latestEventBusId =
                    new Date(checkOutEvent.createdAt).getTime() >
                        new Date(checkInEvent.createdAt).getTime()
                        ? checkOutEvent.busId
                        : checkInEvent.busId;
            }
            else if (checkOutEvent?.busId) {
                latestEventBusId = checkOutEvent.busId;
            }
            else if (checkInEvent?.busId) {
                latestEventBusId = checkInEvent.busId;
            }
            else if (checkOutStatusChanged) {
                latestEventBusId = eventCheckOutBusId;
            }
            else if (checkInStatusChanged) {
                latestEventBusId = eventCheckInBusId;
            }
            const isWrongBus = 
            // Sai xe khi xe của event mới nhất khác xe biên chế của khách.
            Number(passenger.busId) !== Number(latestEventBusId);
            const latestBusCode = await loadBusCode(db, latestEventBusId);
            const targetManagerId = passenger.managerId ?? null;
            const shouldNotifyWrongBus = 
            // Chỉ gửi cảnh báo sai xe khi có thay đổi trạng thái thật sự và khách đang được tick lên/xuống xe.
            // Thao tác bỏ tick không tạo notification mới để tránh spam trưởng xe gốc.
            hasAttendanceStatusChanged &&
                isWrongBus &&
                Boolean(targetManagerId) &&
                ((checkInStatusChanged && nextCheckIn) ||
                    (checkOutStatusChanged && nextCheckOut));
            if (shouldNotifyWrongBus) {
                // Gửi notification cho quản lý xe biên chế của khách để họ biết khách đi nhầm xe.
                // Thông báo gắn với xe gốc để người phụ trách xe gốc biết khách của mình đang ở xe khác.
                const content = `Khách ${passenger.name || `#${passengerId}`} của xe ${passenger.busCode ||
                    passenger.registrationNumber ||
                    passenger.busId} vừa được điểm danh trên xe ${latestBusCode} ở chặng ${round.name || roundId}.`;
                await createNotification(db, targetManagerId, 'attendance.wrong_bus', 'Khách sai xe', content, {
                    tripId: bus.tripId,
                    busId: latestEventBusId,
                    busCode: latestBusCode,
                    roundId,
                    passengerId,
                    transactionId: result.id,
                    targetManagerId,
                    checkIn: result.checkIn,
                    checkOut: result.checkOut,
                    checkInBy: checkInEvent?.actorId ?? null,
                    checkOutBy: checkOutEvent?.actorId ?? null,
                    eventType,
                });
            }
            await db.query('COMMIT');
            if (hasAttendanceStatusChanged) {
                // Chỉ publish realtime sau khi commit thành công.
                // Frontend dùng event này làm tín hiệu refetch, không tự cộng/trừ số liệu từ payload.
                const realtimePayload = {
                    type: shouldNotifyWrongBus
                        ? 'attendance.wrong_bus'
                        : 'attendance.updated',
                    project: prj,
                    tenantId: bus.tenantId,
                    tripId: bus.tripId,
                    roundId,
                    roundName: round.name,
                    busId: latestEventBusId,
                    busCode: latestBusCode,
                    passengerId,
                    passengerName: passenger.name,
                    passengerBusId: passenger.busId,
                    passengerBusCode: passenger.busCode,
                    passengerBusRegistrationNumber: passenger.registrationNumber,
                    passengerBusManagerId: passenger.managerId,
                    checkIn: result.checkIn,
                    checkInAt: checkInEvent?.createdAt ?? null,
                    checkInBy: checkInEvent?.actorId ?? null,
                    checkInBusId: checkInEvent?.busId ?? null,
                    checkOut: result.checkOut,
                    checkOutAt: checkOutEvent?.createdAt ?? null,
                    checkOutBy: checkOutEvent?.actorId ?? null,
                    checkOutBusId: checkOutEvent?.busId ?? null,
                    checkInNote: result.checkInNote ?? '',
                    checkOutNote: result.checkOutNote ?? '',
                    targetManagerId,
                    isWrongBus,
                    requiresReview: isWrongBus,
                    entity: 'transaction',
                    eventType,
                    updatedAt: eventAt.toISOString(),
                };
                // Publish realtime cho frontend refetch/hiển thị cảnh báo mà không cần reload.
                mqttClient.publish(`${uiTopicPrefix}/${bus.tripId}`, JSON.stringify(realtimePayload), { qos: mqttQos });
                mqttClient.publish(`${dashboardTopicPrefix}/${bus.tenantId}`, JSON.stringify(realtimePayload), { qos: mqttQos });
            }
            if (actionId) {
                // ACK được gửi sau commit để offline queue biết action đã thật sự được ghi DB.
                // Nếu worker lỗi trước commit thì không có ACK, frontend sẽ giữ action lại để retry.
                // ACK theo actionId để frontend/offline queue biết action đã được worker ghi DB.
                mqttClient.publish(`${ackTopicPrefix}/${actionId}`, JSON.stringify({
                    type: 'attendance.persisted',
                    status: 'ok',
                    actionId,
                    tripId: bus.tripId,
                    busId,
                    roundId,
                    passengerId,
                    transactionId: result.id,
                    updatedAt: new Date().toISOString(),
                }), {
                    qos: mqttQos,
                    retain: false,
                });
            }
            clearRetainedTopic(topic);
        }
        catch (e) {
            await db.query('ROLLBACK').catch(() => undefined);
            throw e;
        }
        finally {
            db.release();
        }
    };
    mqttClient.on('connect', () => {
        // Kết nối broker xong thì subscribe topic attendance cấu hình trong JSON.
        parentPort?.postMessage(`[${prj}] Connected.`);
        mqttClient.subscribe(config.mqtt.topic, { qos: mqttQos });
    });
    mqttClient.on('message', async (topic, msg) => {
        // Mỗi message được parse JSON rồi đưa vào handler; lỗi sẽ log về master.
        const rawMessage = msg.toString().trim();
        if (!rawMessage) {
            return;
        }
        try {
            const data = JSON.parse(rawMessage);
            await handleAttendanceMessage(topic, data);
        }
        catch (e) {
            parentPort?.postMessage(`[${prj}] Attendance error: ${e.message}`);
        }
    });
    setInterval(async () => {
        // Log định kỳ tình trạng pool DB để phát hiện rò rỉ connection khi chạy lâu.
        const total = pool.totalCount;
        const idle = pool.idleCount;
        if (total > 0) {
            parentPort?.postMessage(`[${prj}] DB Pool Status: Total ${total}, Idle ${idle}`);
        }
    }, 60000);
}
init().catch((err) => parentPort?.postMessage(`Fatal: ${err.message}`));
//# sourceMappingURL=worker.js.map