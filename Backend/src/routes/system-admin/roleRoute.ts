import { Router } from 'express';
import { verifyVerifiedFirebaseTokenOnly } from '../../middleware/authMiddleware';
import { roleController } from '../../controllers/roleController';

const router = Router();

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Lấy danh sách vai trò
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách vai trò
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/roles', verifyVerifiedFirebaseTokenOnly, roleController.getAll);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Tạo vai trò mới
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: manager
 *               description:
 *                 type: string
 *                 example: Quản lý xe
 *     responses:
 *       201:
 *         description: Tạo vai trò thành công
 *       400:
 *         description: Thiếu tên vai trò
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/roles', verifyVerifiedFirebaseTokenOnly, roleController.create);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Cập nhật vai trò
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của vai trò
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Cập nhật vai trò thành công
 *       400:
 *         description: ID vai trò không hợp lệ
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/roles/:id', verifyVerifiedFirebaseTokenOnly, roleController.update);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Xóa vai trò
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của vai trò
 *     responses:
 *       200:
 *         description: Xóa vai trò thành công
 *       400:
 *         description: ID vai trò không hợp lệ hoặc vai trò đang được sử dụng
 *       403:
 *         description: Chỉ dành cho SuperAdmin
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/roles/:id', verifyVerifiedFirebaseTokenOnly, roleController.delete);

export default router;
