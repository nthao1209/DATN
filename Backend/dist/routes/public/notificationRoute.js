"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const notificationController_1 = require("../../controllers/notificationController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.verifyFirebaseToken);
/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lấy danh sách thông báo của user hiện tại
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Chỉ lấy thông báo chưa đọc
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Lọc theo loại thông báo
 *       - in: query
 *         name: tripId
 *         schema:
 *           type: integer
 *         description: Lọc theo ID chuyến xe trong payload
 *       - in: query
 *         name: busId
 *         schema:
 *           type: integer
 *         description: Lọc theo ID xe trong payload
 *       - in: query
 *         name: roundId
 *         schema:
 *           type: integer
 *         description: Lọc theo ID chặng trong payload
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Số lượng thông báo tối đa, tối đa 200
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Vị trí bắt đầu phân trang
 *     responses:
 *       200:
 *         description: Danh sách thông báo
 *       400:
 *         description: Thiếu thông tin tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/notifications', notificationController_1.notificationController.list);
/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Tạo thông báo cho user hiện tại
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 example: unlock.request.created
 *               title:
 *                 type: string
 *                 example: Yêu cầu mở khóa mới
 *               content:
 *                 type: string
 *                 example: Có yêu cầu mở khóa điểm danh mới
 *               payload:
 *                 type: object
 *                 nullable: true
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Tạo thông báo thành công
 *       400:
 *         description: Thiếu thông tin tổ chức hoặc type, title và content là bắt buộc
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/notifications', notificationController_1.notificationController.create);
/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo là đã đọc
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *     responses:
 *       200:
 *         description: Cập nhật toàn bộ thông báo chưa đọc thành đã đọc
 *       400:
 *         description: Thiếu thông tin tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch('/notifications/read-all', notificationController_1.notificationController.markAllRead);
/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Đánh dấu một thông báo là đã đọc
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Cập nhật thông báo thành công
 *       400:
 *         description: Thiếu thông tin tổ chức hoặc thiếu ID thông báo
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy thông báo
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch('/notifications/:id/read', notificationController_1.notificationController.markRead);
/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Xóa một thông báo
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Xóa thông báo thành công
 *       400:
 *         description: Thiếu thông tin tổ chức hoặc thiếu ID thông báo
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy thông báo
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/notifications/:id', notificationController_1.notificationController.remove);
/**
 * @swagger
 * /api/notifications:
 *   delete:
 *     summary: Xóa toàn bộ thông báo của user hiện tại
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tổ chức hiện tại
 *     responses:
 *       200:
 *         description: Xóa toàn bộ thông báo thành công
 *       400:
 *         description: Thiếu thông tin tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/notifications', notificationController_1.notificationController.removeAll);
exports.default = router;
