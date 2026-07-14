"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const userController_1 = require("../../controllers/userController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy danh sách user toàn hệ thống
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách user kèm tenant và vai trò
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/users', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, userController_1.userController.getAll);
/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Cập nhật thông tin user và vai trò trong tenant
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               description:
 *                 type: string
 *                 nullable: true
 *               roleId:
 *                 type: integer
 *                 example: 3
 *               tenantId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Cập nhật user thành công
 *       400:
 *         description: ID user, ID vai trò hoặc tenantId không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       404:
 *         description: Không tìm thấy thành viên trong tổ chức
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/users/:id', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, userController_1.userController.update);
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Xóa user khỏi các tổ chức
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Xóa user khỏi tổ chức thành công
 *       400:
 *         description: ID người dùng không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/users/:id', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, userController_1.userController.removeFromTenant);
/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Bật hoặc vô hiệu hóa tài khoản user
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isDisabled
 *             properties:
 *               isDisabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái user thành công
 *       400:
 *         description: ID người dùng không hợp lệ hoặc thiếu isDisabled
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch('/users/:id/status', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, userController_1.userController.setStatus);
exports.default = router;
