"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const roundController_1 = require("../../controllers/roundController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/trips/{tripId}/rounds:
 *   get:
 *     summary: Lấy danh sách chặng theo chuyến
 *     tags:
 *       - Rounds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     responses:
 *       200:
 *         description: Danh sách chặng kèm thống kê
 *       400:
 *         description: Thiếu thông tin chuyến xe
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/trips/:tripId/rounds', authMiddleware_1.verifyFirebaseToken, roundController_1.roundController.getAll);
/**
 * @swagger
 * /api/trips/{tripId}/rounds:
 *   post:
 *     summary: Tạo chặng mới trong chuyến
 *     tags:
 *       - Rounds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - time
 *               - status
 *             properties:
 *               name:
 *                 type: string
 *                 example: Chặng 1
 *               time:
 *                 type: string
 *                 example: "08:00"
 *               status:
 *                 type: string
 *                 enum: [DOING, DONE]
 *                 example: DOING
 *     responses:
 *       201:
 *         description: Tạo chặng thành công
 *       400:
 *         description: Thiếu trường bắt buộc hoặc trạng thái không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy chuyến xe
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/trips/:tripId/rounds', authMiddleware_1.verifyFirebaseToken, roundController_1.roundController.create);
/**
 * @swagger
 * /api/rounds/{id}:
 *   put:
 *     summary: Cập nhật chặng
 *     tags:
 *       - Rounds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chặng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               time:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DOING, DONE]
 *     responses:
 *       200:
 *         description: Cập nhật chặng thành công
 *       400:
 *         description: Thiếu mã chặng hoặc chặng chưa đủ điều kiện hoàn thành
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy chặng
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/rounds/:id', authMiddleware_1.verifyFirebaseToken, roundController_1.roundController.update);
/**
 * @swagger
 * /api/rounds/{id}:
 *   delete:
 *     summary: Xóa chặng
 *     tags:
 *       - Rounds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chặng
 *     responses:
 *       200:
 *         description: Xóa chặng thành công
 *       400:
 *         description: Thiếu mã chặng
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy chặng
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/rounds/:id', authMiddleware_1.verifyFirebaseToken, roundController_1.roundController.delete);
exports.default = router;
