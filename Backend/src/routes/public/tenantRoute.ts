import { Router } from 'express';
import { createTenant, joinTenant, renameCurrentTenant } from '../../controllers/tenantController';
import { verifyVerifiedFirebaseTokenOnly } from '../../middleware/authMiddleware';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/tenants/create:
 *   post:
 *     summary: Tạo tổ chức mới cho user hiện tại
 *     tags:
 *       - Tenants
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
 *                 example: Công ty Du lịch ABC
 *     responses:
 *       200:
 *         description: Tạo tổ chức thành công và trả về mã tham gia
 *       400:
 *         description: Thiếu tên tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/tenants/create', verifyVerifiedFirebaseTokenOnly, createTenant);

/**
 * @swagger
 * /api/tenants/join:
 *   post:
 *     summary: Tham gia tổ chức bằng mã mời
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - joinCode
 *             properties:
 *               joinCode:
 *                 type: string
 *                 example: ABC234
 *     responses:
 *       200:
 *         description: Tham gia tổ chức thành công
 *       400:
 *         description: Không tìm thấy tổ chức hoặc user đã là thành viên
 *       401:
 *         description: Không xác định được người dùng
 */
router.post('/tenants/join', verifyVerifiedFirebaseTokenOnly, joinTenant);

/**
 * @swagger
 * /api/tenants/current:
 *   put:
 *     summary: Đổi tên tổ chức hiện tại
 *     tags:
 *       - Tenants
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
 *                 example: Công ty Du lịch ABC
 *     responses:
 *       200:
 *         description: Đổi tên tổ chức thành công
 *       400:
 *         description: Thiếu tên tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ admin của tổ chức mới được đổi tên
 *       500:
 *         description: Lỗi server
 */
router.put('/tenants/current', verifyFirebaseToken, renameCurrentTenant);

export default router;
