"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const transactionController_1 = require("../../controllers/transactionController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Lấy danh sách transaction kèm hành khách, chặng, xe
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách transaction kèm hành khách, chặng, xe
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Từ chối truy cập, chỉ trưởng đoàn/admin và quản lý xe được xem
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/transactions', authMiddleware_1.verifyFirebaseToken, transactionController_1.transactionController.getAll);
/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Thêm hành khách vào bảng điểm danh của một xe và chặng
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - busId
 *               - roundId
 *               - passengerId
 *             properties:
 *               busId:
 *                 type: integer
 *                 example: 1
 *               roundId:
 *                 type: integer
 *                 example: 1
 *               passengerId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Transaction đã tồn tại hoặc được cập nhật
 *       201:
 *         description: Tạo transaction thành công
 *       400:
 *         description: Thiếu busId, roundId, passengerId hoặc thao tác điểm danh phải đi qua MQTT
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Không được phép thêm khách vào xe/chặng này, chỉ quản lý xe được thao tác
 *       404:
 *         description: Không tìm thấy xe, chặng hoặc hành khách
 *       409:
 *         description: Hành khách đã hoàn tất hoặc đang điểm danh ở xe khác
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/transactions', authMiddleware_1.verifyFirebaseToken, transactionController_1.transactionController.create);
/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Xóa bảng điểm danh
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của transaction
 *     responses:
 *       200:
 *         description: Xóa transaction thành công
 *       400:
 *         description: ID giao dịch không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Từ chối truy cập, chỉ quản lý xe được thao tác
 *       404:
 *         description: Không tìm thấy giao dịch
 *       409:
 *         description: Không thể xóa khách đang có trạng thái điểm danh
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/transactions/:id', authMiddleware_1.verifyFirebaseToken, transactionController_1.transactionController.delete);
exports.default = router;
